import { describe, expect, it } from "vitest";

import {
  EnvironmentConfigurationError,
  parseServerEnvironment,
} from "./environment";

const validProductionEnvironment = {
  APP_ENV: "production",
  DATABASE_URL: "postgresql://dealerflow:secret@db.example.com/dealerflow",
  BETTER_AUTH_SECRET: "a-high-entropy-secret-with-32-characters",
  BETTER_AUTH_URL: "https://crm.example.com",
  DEALERFLOW_JOB_SECRET: "a-separate-job-secret-with-32-characters",
  DEALERFLOW_EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_secret",
  DEALERFLOW_EMAIL_FROM: "DealerFlow <accounts@example.com>",
};

describe("parseServerEnvironment", () => {
  it("accepts a complete production environment", () => {
    const environment = parseServerEnvironment(validProductionEnvironment, {
      database: true,
      authentication: true,
    });

    expect(environment.appEnvironment).toBe("production");
    expect(environment.databaseUrl).toMatch(/^postgresql:/);
    expect(Object.isFrozen(environment)).toBe(true);
  });

  it("allows local builds without production integrations", () => {
    expect(parseServerEnvironment({ APP_ENV: "development" })).toEqual({
      appEnvironment: "development",
    });
  });

  it("requires database and authentication settings when requested", () => {
    expect(() =>
      parseServerEnvironment(
        { APP_ENV: "production" },
        { database: true, authentication: true },
      ),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("rejects non-PostgreSQL database URLs without exposing their value", () => {
    try {
      parseServerEnvironment({
        APP_ENV: "production",
        DATABASE_URL: "mysql://user:sensitive-password@example.com/database",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentConfigurationError);
      expect(String(error)).not.toContain("sensitive-password");
    }
  });

  it("accepts only explicit supported database SSL modes", () => {
    expect(
      parseServerEnvironment({
        ...validProductionEnvironment,
        DATABASE_SSL_MODE: "verify-full",
      }).databaseSslMode,
    ).toBe("verify-full");
    expect(
      parseServerEnvironment({
        ...validProductionEnvironment,
        DATABASE_SSL_MODE: "disable",
      }).databaseSslMode,
    ).toBe("disable");
    expect(() =>
      parseServerEnvironment({
        ...validProductionEnvironment,
        DATABASE_SSL_MODE: "require",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("requires HTTPS authentication URLs outside local environments", () => {
    expect(() =>
      parseServerEnvironment({
        ...validProductionEnvironment,
        BETTER_AUTH_URL: "http://crm.example.com",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("rejects authentication secrets shorter than 32 characters", () => {
    expect(() =>
      parseServerEnvironment({
        ...validProductionEnvironment,
        BETTER_AUTH_SECRET: "too-short",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });
  it("requires a separate high-entropy secret for internal jobs", () => {
    expect(() => parseServerEnvironment({ APP_ENV: "production" }, { jobs: true })).toThrow(EnvironmentConfigurationError);
    expect(() => parseServerEnvironment({ APP_ENV: "production", DEALERFLOW_JOB_SECRET: "short" }, { jobs: true })).toThrow(EnvironmentConfigurationError);
    expect(parseServerEnvironment(validProductionEnvironment, { jobs: true }).jobSecret).toHaveLength(40);
  });
  it("validates transactional email configuration only when required", () => {
    expect(parseServerEnvironment(validProductionEnvironment, { email: true }).emailProvider).toBe("resend");
    expect(() => parseServerEnvironment({ APP_ENV: "production", DEALERFLOW_EMAIL_PROVIDER: "unsupported" }, { email: true })).toThrow(EnvironmentConfigurationError);
    expect(() => parseServerEnvironment({ APP_ENV: "production", DEALERFLOW_EMAIL_PROVIDER: "resend" }, { email: true })).toThrow(EnvironmentConfigurationError);
  });
  it("requires paired, secure operational alert configuration",()=>{
    expect(()=>parseServerEnvironment({...validProductionEnvironment,DEALERFLOW_ALERT_WEBHOOK_URL:"https://alerts.example.com/events"})).toThrow(EnvironmentConfigurationError);
    expect(()=>parseServerEnvironment({...validProductionEnvironment,DEALERFLOW_ALERT_WEBHOOK_URL:"http://alerts.example.com/events",DEALERFLOW_ALERT_WEBHOOK_SECRET:"a-32-character-operational-secret-key"})).toThrow(EnvironmentConfigurationError);
    expect(parseServerEnvironment({...validProductionEnvironment,DEALERFLOW_ALERT_WEBHOOK_URL:"https://alerts.example.com/events",DEALERFLOW_ALERT_WEBHOOK_SECRET:"a-32-character-operational-secret-key"}).alertWebhookUrl).toBe("https://alerts.example.com/events");
  });
  it("requires an explicit supported AI provider, key, and model",()=>{const configured={...validProductionEnvironment,DEALERFLOW_AI_PROVIDER:"openai",OPENAI_API_KEY:"sk-project-secret",DEALERFLOW_AI_MODEL:"gpt-5.6"};expect(parseServerEnvironment(configured,{ai:true}).aiModel).toBe("gpt-5.6");expect(()=>parseServerEnvironment({...validProductionEnvironment,DEALERFLOW_AI_PROVIDER:"openai"},{ai:true})).toThrow(EnvironmentConfigurationError);expect(()=>parseServerEnvironment({...configured,DEALERFLOW_AI_MODEL:"../../bad model"},{ai:true})).toThrow(EnvironmentConfigurationError);});
});
