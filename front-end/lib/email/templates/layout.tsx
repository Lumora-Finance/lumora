import { Body, Button, Container, Head, Hr, Html, Img, Preview, Section, Text } from "react-email";

import { SITE_URL } from "@/lib/site";

const GREEN = "#1F5C45";
const INK = "#14201B";
const MUTED = "#6B7B73";
const LINE = "#DCE3DF";
const PAPER = "#F6F3EC";

type Rendered = {
  preview: string;
  lines: string[];
  buttons: { label: string; href: string }[];
  image?: { src: string; alt: string };
};

/** Every Lumora email: the logo, a few plain lines, one main button. A second answer sits beside it. */
export function EmailLayout({ preview, lines, buttons, image }: Rendered) {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: PAPER, margin: 0, padding: "24px 12px", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ backgroundColor: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 12, maxWidth: 480, padding: 24 }}>
          <Img src={`${SITE_URL}/brand/lumora-mark.png`} alt="Lumora" width={32} height={32} />
          <Section style={{ marginTop: 16 }}>
            {lines.map((line) => (
              <Text key={line} style={{ color: INK, fontSize: 16, lineHeight: "24px", margin: "0 0 12px" }}>
                {line}
              </Text>
            ))}
            {image && <Img src={image.src} alt={image.alt} width={432} style={{ borderRadius: 8, marginBottom: 12, maxWidth: "100%" }} />}
          </Section>
          {buttons.length > 0 && (
            <Section style={{ marginTop: 8 }}>
              {buttons.map((button, index) => (
                <Button
                  key={button.label}
                  href={button.href}
                  style={{
                    backgroundColor: index === 0 ? GREEN : "#FFFFFF",
                    border: `1px solid ${GREEN}`,
                    borderRadius: 999,
                    color: index === 0 ? "#FFFFFF" : GREEN,
                    fontSize: 16,
                    fontWeight: 600,
                    marginRight: 8,
                    marginTop: 8,
                    padding: "12px 20px",
                  }}
                >
                  {button.label}
                </Button>
              ))}
            </Section>
          )}
          <Hr style={{ borderColor: LINE, margin: "24px 0 12px" }} />
          <Text style={{ color: MUTED, fontSize: 13, lineHeight: "20px", margin: 0 }}>
            Lumora, Jos. You get these because you have a booking or follow produce on the board.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
