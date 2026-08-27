import { createHash } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type InventoryImageContentType = "image/jpeg" | "image/png" | "image/webp";

export interface VerifiedStoredImage {
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
  contentType: InventoryImageContentType;
}

export class InventoryMediaStorageError extends Error {
  constructor(message: string) { super(message); this.name = "InventoryMediaStorageError"; }
}

export class R2InventoryMediaStorage {
  private readonly client: S3Client;
  constructor(private readonly configuration: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; publicBaseUrl: string }) {
    this.client = new S3Client({ region: "auto", endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey } });
  }
  async createUploadUrl(input: { objectKey: string; contentType: InventoryImageContentType; byteSize: number }) {
    const command = new PutObjectCommand({ Bucket: this.configuration.bucket, Key: input.objectKey, ContentType: input.contentType, ContentLength: input.byteSize, CacheControl: "public, max-age=31536000, immutable" });
    return { method: "PUT" as const, url: await getSignedUrl(this.client, command, { expiresIn: 300 }), expiresInSeconds: 300, headers: { "content-type": input.contentType } };
  }
  async verify(input: { objectKey: string; contentType: InventoryImageContentType; byteSize: number }): Promise<VerifiedStoredImage> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.configuration.bucket, Key: input.objectKey }));
    if (!response.Body) throw new InventoryMediaStorageError("The uploaded image is unavailable.");
    const bytes = Buffer.from(await response.Body.transformToByteArray());
    if (bytes.length !== input.byteSize || response.ContentLength !== input.byteSize) throw new InventoryMediaStorageError("The uploaded image size does not match the upload intent.");
    if (response.ContentType !== input.contentType) throw new InventoryMediaStorageError("The uploaded image content type does not match the upload intent.");
    const dimensions = inspectImage(bytes, input.contentType);
    return { byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), contentType: input.contentType, ...dimensions };
  }
  async remove(objectKey: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.configuration.bucket, Key: objectKey })); }
  publicUrl(objectKey: string) { return `${this.configuration.publicBaseUrl.replace(/\/$/, "")}/${objectKey}`; }
}

export function inspectImage(bytes: Buffer, declaredType: InventoryImageContentType): { width: number; height: number } {
  const actualType = detectType(bytes);
  if (actualType !== declaredType) throw new InventoryMediaStorageError("The uploaded file signature does not match its content type.");
  const dimensions = actualType === "image/png" ? pngDimensions(bytes) : actualType === "image/jpeg" ? jpegDimensions(bytes) : webpDimensions(bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 20000 || dimensions.height > 20000) throw new InventoryMediaStorageError("The uploaded image dimensions are invalid.");
  return dimensions;
}
function detectType(bytes:Buffer):InventoryImageContentType{if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return"image/png";if(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8)return"image/jpeg";if(bytes.length>=30&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return"image/webp";throw new InventoryMediaStorageError("The uploaded file is not a supported image.");}
function pngDimensions(bytes:Buffer){return{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};}
function jpegDimensions(bytes:Buffer){let offset=2;while(offset+9<bytes.length){if(bytes[offset]!==0xff){offset+=1;continue;}const marker=bytes[offset+1]!;if(marker===0xd8||marker===0xd9){offset+=2;continue;}const length=bytes.readUInt16BE(offset+2);if(length<2||offset+2+length>bytes.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};offset+=2+length;}throw new InventoryMediaStorageError("The JPEG dimensions could not be verified.");}
function webpDimensions(bytes:Buffer){const kind=bytes.toString("ascii",12,16);if(kind==="VP8X"&&bytes.length>=30)return{width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};if(kind==="VP8L"&&bytes.length>=25){const b1=bytes[21]!,b2=bytes[22]!,b3=bytes[23]!,b4=bytes[24]!;return{width:1+(((b2&63)<<8)|b1),height:1+(((b4&15)<<10)|(b3<<2)|(b2>>6))};}if(kind==="VP8 "&&bytes.length>=30&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a)return{width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};throw new InventoryMediaStorageError("The WebP dimensions could not be verified.");}
