import type { ServerEnvironment } from "@/lib/server/config";
import { SignedAlertWebhook } from "./alert-webhook";
import { StructuredTelemetry, type TelemetryEvent } from "./telemetry";

export class OperationalReporter {
  private readonly telemetry:StructuredTelemetry;
  constructor(private readonly environment:ServerEnvironment,telemetry?:StructuredTelemetry){this.telemetry=telemetry??new StructuredTelemetry();}
  async report(event:TelemetryEvent,{alert=false}:{alert?:boolean}={}):Promise<void>{
    this.telemetry.emit(event);
    if(!alert||!this.environment.alertWebhookUrl||!this.environment.alertWebhookSecret)return;
    try{await new SignedAlertWebhook({url:this.environment.alertWebhookUrl,secret:this.environment.alertWebhookSecret}).deliver(event);}
    catch{this.telemetry.emit({code:"operations.alert.delivery_failed",severity:"error",correlationId:event.correlationId,attributes:{sourceCode:event.code}});}
  }
}
