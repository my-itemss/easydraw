import { useEffect } from "react";
import { Container, LinkButton } from "../../components/ui";

export default function NotFoundPage() {
  useEffect(() => {
    document.title = "Page not found | easydraw";
  }, []);
  return (
    <Container className="py-24 text-center sm:py-32">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">404</p>
      <h1 className="mx-auto mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">This page took a wrong turn</h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[var(--fg-muted)]">
        The link may be old or mistyped. Here are a few places that do exist.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton to="/product" size="lg">
          Product
        </LinkButton>
        <LinkButton to="/docs" variant="secondary" size="lg">
          Docs
        </LinkButton>
        <LinkButton to="/diagramgpt" variant="secondary" size="lg">
          DiagramGPT
        </LinkButton>
        <LinkButton to="/app" variant="secondary" size="lg">
          Open the app
        </LinkButton>
      </div>
    </Container>
  );
}
