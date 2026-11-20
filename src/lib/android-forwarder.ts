// What an Android SMS forwarder app sends to Mizan. Pure, so the pairing page and tests can share it.

/** The free, open-source forwarder Mizan's instructions use. Not on Google Play: Google doesn't allow SMS forwarders there. */
export const FORWARDER = {
  name: "SMS to URL Forwarder",
  fdroid: "https://f-droid.org/packages/tech.bogomolov.incomingsmsgateway/",
  github: "https://github.com/bogkonstantin/android_income_sms_gateway_webhook/releases",
} as const;

/**
 * The JSON body for SMS to URL Forwarder. %from%, %text% and %receivedStamp% (Unix milliseconds, unquoted) are its
 * placeholders. The key goes in the body because that app's rules have no place for an Authorization header.
 */
export function forwarderTemplate(key: string): string {
  return `{"key":"${key}","sender":"%from%","text":"%text%","receivedAt":%receivedStamp%}`;
}

/** For apps that can set headers (MacroDroid, Tasker, HTTP Shortcuts): the body without the key. */
export const HEADER_BODY_EXAMPLE = `{"sender":"<SMS sender>","text":"<SMS text>"}`;
