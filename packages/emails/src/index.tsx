import type { CSSProperties } from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Button,
  Hr,
  Link,
  Row,
  Column,
  render,
} from "react-email";

/** Fixed 26-basic email identity: email clients cannot apply the browser's theme variables. */
const brand = {
  ink: "#14110e",
  paper: "#fff6e8",
  quiet: "#e4d5c0",
  accent: "#ff4d3a",
  gold: "#ffc43a",
  surface: "#2c241c",
  line: "#5c5144",
};
export type EmailMessage = { subject: string; text: string };

type Presentation = {
  eyebrow: string;
  title: string;
  preview: string;
  action: string;
  code?: string;
  link?: string;
  paragraphs: string[];
  stats?: { label: string; value: string }[];
};

/** Presentation is derived from the canonical saved text, including delivery retries.
 * This keeps existing outbox idempotency and avoids a second persisted email format.
 */
export function emailPresentation(message: EmailMessage): Presentation {
  const paragraphs = message.text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Canonical messages append their generated action URL after all guest-provided text.
  // A nickname containing a URL must never replace that action.
  const candidate = [...message.text.matchAll(/https?:\/\/[^\s<>]+/g)].at(-1)?.[0];
  let link: string | undefined;
  if (candidate) {
    try {
      const url = new URL(candidate);
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password)
        link = url.toString();
    } catch {
      /* A broken URL stays plain text. */
    }
  }
  const code = message.text.match(/^Your sign-in code: (\d{6})$/m)?.[1];
  const isSignIn = message.subject === "Sign in to 26";
  const isVerify = message.subject === "Confirm your email for the party results";
  const isResults = message.subject === "Your party result";
  const result = isResults
    ? message.text.match(/finished in position (\d+) with (\d+) points/)
    : null;
  const trolls = isResults
    ? message.text.match(/Trolls given: (\d+)\. Trolls received: (\d+)\./)
    : null;
  return {
    eyebrow: isSignIn
      ? "BEHIND THE SCENES"
      : isVerify
        ? "SAVE YOUR NIGHT"
        : isResults
          ? "THE RESULTS ARE IN"
          : "A NOTE FROM THE PARTY",
    title: isSignIn
      ? "Your backstage pass."
      : isVerify
        ? "Make it official."
        : isResults
          ? "What a night."
          : message.subject,
    preview: isSignIn
      ? "Your one-time code and secure sign-in link. Valid for five minutes."
      : isVerify
        ? "Confirm your email to get your personal party results."
        : isResults
          ? "Your points, your place, your very own slice of the chaos."
          : message.subject,
    action: isSignIn
      ? "Open admin sign-in"
      : isVerify
        ? "Confirm my email"
        : isResults
          ? "See my night in full"
          : "Open your link",
    code,
    link,
    paragraphs: isSignIn
      ? [
          link
            ? "Enter the code on your admin sign-in page, or use your private link below."
            : "Enter the code on your admin sign-in page to open your controls.",
        ]
      : paragraphs.filter(
          (p) =>
            !p.startsWith("Your sign-in code:") &&
            !(link && p.includes(candidate!)) &&
            !(isResults && p.startsWith("Trolls given:")),
        ),
    ...(result
      ? {
          stats: [
            { label: "YOUR PLACE", value: `#${result[1]}` },
            { label: "POINTS", value: result[2]! },
            ...(trolls
              ? [
                  {
                    label: "TROLLS GIVEN / RECEIVED",
                    value: `${trolls[1]} / ${trolls[2]}`,
                  },
                ]
              : []),
          ],
        }
      : {}),
  };
}

const copy: CSSProperties = {
  color: brand.quiet,
  fontSize: 16,
  lineHeight: "26px",
  margin: "0 0 18px",
};
export function PartyEmail({ message }: { message: EmailMessage }) {
  const content = emailPresentation(message);
  return (
    <Html lang="en-GB">
      <Head>
        <meta name="color-scheme" content="dark light" />
        <meta name="supported-color-schemes" content="dark light" />
        <style>{`@media only screen and (max-width:480px){.email-wrap,.email-content{padding:0!important}.email-wrap>tbody>tr>td{padding:20px 10px!important}.email-content>tbody>tr>td{padding:30px 22px!important}.email-title{font-size:38px!important;line-height:42px!important}.email-code{font-size:32px!important;letter-spacing:8px!important}.email-stat{display:block!important;width:100%!important;padding-bottom:14px!important}}`}</style>
      </Head>
      <Preview>{content.preview}</Preview>
      <Body
        style={{
          margin: 0,
          backgroundColor: brand.ink,
          fontFamily: "Arial, Helvetica, sans-serif",
          color: brand.paper,
        }}
      >
        <Container
          className="email-wrap"
          style={{ maxWidth: 600, padding: "40px 16px" }}
        >
          <Section style={{ padding: "0 8px 24px" }}>
            <Row>
              <Column>
                <Text
                  style={{
                    margin: 0,
                    color: brand.accent,
                    fontSize: 48,
                    lineHeight: "48px",
                    fontWeight: 900,
                    letterSpacing: "-5px",
                  }}
                >
                  26<span style={{ color: brand.gold }}>.</span>
                </Text>
              </Column>
              <Column align="right">
                <Text
                  style={{
                    margin: 0,
                    color: brand.quiet,
                    fontSize: 10,
                    letterSpacing: 2,
                    fontWeight: 700,
                  }}
                >
                  HUMZA’S BIRTHDAY
                  <br />
                  ONE NIGHT. FULL CHAOS.
                </Text>
              </Column>
            </Row>
          </Section>
          <Section
            style={{
              borderRadius: 24,
              border: `1px solid ${brand.line}`,
              overflow: "hidden",
              backgroundColor: brand.surface,
            }}
          >
            <Section style={{ height: 8, backgroundColor: brand.accent }}>
              <Text style={{ margin: 0, fontSize: 1, lineHeight: "8px" }}>&nbsp;</Text>
            </Section>
            <Section className="email-content" style={{ padding: "42px 38px" }}>
              <Text
                style={{
                  color: brand.gold,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: 800,
                  margin: "0 0 18px",
                }}
              >
                {content.eyebrow}
              </Text>
              <Heading
                className="email-title"
                style={{
                  fontSize: 48,
                  lineHeight: "52px",
                  fontWeight: 900,
                  letterSpacing: "-2px",
                  margin: "0 0 24px",
                  color: brand.paper,
                }}
              >
                {content.title}
              </Heading>
              {content.code ? (
                <Section
                  style={{
                    padding: "22px 16px",
                    backgroundColor: brand.ink,
                    borderRadius: 16,
                    border: `1px solid ${brand.line}`,
                    marginBottom: 26,
                    textAlign: "center",
                  }}
                >
                  <Text
                    style={{
                      color: brand.quiet,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 2,
                      margin: "0 0 12px",
                    }}
                  >
                    YOUR ONE-TIME SIGN-IN CODE
                  </Text>
                  <Text
                    className="email-code"
                    style={{
                      fontSize: 42,
                      lineHeight: "48px",
                      letterSpacing: 12,
                      fontWeight: 800,
                      color: brand.gold,
                      fontFamily: "'Courier New', monospace",
                      margin: 0,
                    }}
                  >
                    {content.code}
                  </Text>
                  <Text
                    style={{ color: brand.quiet, fontSize: 12, margin: "12px 0 0" }}
                  >
                    Valid for five minutes · use the latest email
                  </Text>
                </Section>
              ) : null}
              {content.stats ? (
                <Row style={{ marginBottom: 24 }}>
                  {content.stats.map((stat) => (
                    <Column
                      key={stat.label}
                      className="email-stat"
                      style={{ verticalAlign: "top", paddingRight: 14 }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: brand.quiet,
                          letterSpacing: 1,
                          margin: "0 0 8px",
                        }}
                      >
                        {stat.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 32,
                          lineHeight: "38px",
                          fontWeight: 900,
                          color: brand.gold,
                          margin: 0,
                        }}
                      >
                        {stat.value}
                      </Text>
                    </Column>
                  ))}
                </Row>
              ) : null}
              {content.paragraphs.map((paragraph, i) => (
                <Text key={i} style={copy}>
                  {paragraph}
                </Text>
              ))}
              {content.link ? (
                <Section style={{ marginTop: 28 }}>
                  <Button
                    href={content.link}
                    style={{
                      backgroundColor: brand.accent,
                      borderRadius: 12,
                      color: brand.ink,
                      padding: "18px 26px",
                      fontSize: 16,
                      fontWeight: 800,
                      textDecoration: "none",
                    }}
                  >
                    {content.action} →
                  </Button>
                  <Text
                    style={{
                      ...copy,
                      fontSize: 12,
                      lineHeight: "20px",
                      margin: "20px 0 0",
                    }}
                  >
                    Button not opening? Copy this link into your browser:
                    <br />
                    <Link
                      href={content.link}
                      style={{
                        color: brand.paper,
                        wordBreak: "break-all",
                        textDecoration: "underline",
                      }}
                    >
                      {content.link}
                    </Link>
                  </Text>
                </Section>
              ) : null}
              {content.code ? (
                <Text
                  style={{
                    ...copy,
                    fontSize: 12,
                    lineHeight: "20px",
                    margin: "22px 0 0",
                  }}
                >
                  Opening the link takes you to a confirmation page. If you didn’t
                  request this email, you can safely ignore it.
                </Text>
              ) : null}
            </Section>
          </Section>
          <Section style={{ padding: "24px 12px 0" }}>
            <Hr style={{ borderColor: brand.line, margin: "0 0 20px" }} />
            <Text
              style={{
                fontSize: 12,
                lineHeight: "20px",
                color: brand.quiet,
                margin: "0 0 6px",
              }}
            >
              Made for one very good night.
            </Text>
            <Text
              style={{
                fontSize: 11,
                lineHeight: "18px",
                color: brand.quiet,
                margin: 0,
              }}
            >
              26.humza.website · Keep your personal links and codes to yourself.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderPartyEmail(message: EmailMessage): Promise<string> {
  return render(<PartyEmail message={message} />);
}
