#!/usr/bin/env node
/** Send one actionable email for a failed VOA GitHub Actions workflow. */
import nodemailer from "nodemailer";

const required = ["GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "ALERT_EMAIL", "FAILED_WORKFLOW", "FAILED_RUN_URL"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const { GMAIL_ADDRESS, GMAIL_APP_PASSWORD, ALERT_EMAIL, FAILED_WORKFLOW, FAILED_RUN_URL, FAILED_CONCLUSION } = process.env;
const subject = `VOA workflow needs attention: ${FAILED_WORKFLOW}`;
const body = [
  `The VOA GitHub Actions workflow “${FAILED_WORKFLOW}” finished with ${FAILED_CONCLUSION || "failure"}.`,
  "",
  "Open the run to see the failed step and logs:",
  FAILED_RUN_URL,
  "",
  "This is a new failure notification. The affected workflow may have its own retry, repair, or more specific alert path.",
].join("\n");

const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: GMAIL_ADDRESS, pass: GMAIL_APP_PASSWORD },
  connectionTimeout: 15_000,
  socketTimeout: 20_000,
});
const result = await transport.sendMail({ from: GMAIL_ADDRESS, to: ALERT_EMAIL, subject, text: body });
if (!result.accepted?.some(address => String(address).toLowerCase() === ALERT_EMAIL.toLowerCase())) {
  throw new Error("SMTP did not accept the workflow-failure alert recipient");
}
console.log(`Gmail SMTP accepted workflow-failure alert ${result.messageId} for ${ALERT_EMAIL}.`);
