import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Container } from "../../components/ui";
import DiagramTool from "../../components/tools/DiagramTool";
import RepoTool from "../../components/tools/RepoTool";
import FileTool from "../../components/tools/FileTool";
import { PROMPT_GENERATORS } from "../../components/tools/generators";
import { COMMON_FAQ, ToolFaq, ToolHero, ToolSection, ToolsGrid } from "../../components/tools/ToolParts";
import NotFoundPage from "./NotFoundPage";

const REPO_FAQ = [
  {
    q: "What does it read?",
    a: "The public file tree from the GitHub API. Top-level folders become groups and notable files such as package.json, Dockerfile, docker-compose.yml, Terraform files, schema files and entry points become nodes.",
  },
  { q: "Does it work with private repositories?", a: "No. Only public repositories at https://github.com/<owner>/<repo> are supported, and no source code is cloned." },
  { q: "Why is my diagram simple?", a: "It is built from file names and layout, not from reading your code. Treat it as a starting point and edit the code or refine it by chat." },
  ...COMMON_FAQ.slice(0, 1),
];

const FILE_FAQ = [
  { q: "Which files are supported?", a: "SQL schema files with CREATE TABLE (Postgres, MySQL, SQLite), Terraform .tf files, and docker-compose.yml files." },
  { q: "Is my file uploaded?", a: "No. Parsing happens in your browser with no network request. The same converters power the import dialog in the editor." },
  { q: "What is skipped?", a: "Anything the converter cannot map, such as indexes, comments or unusual syntax. Skipped items are listed as notes under the file so nothing is silently dropped." },
  { q: "Can I edit the result?", a: "Yes. Switch to the Code tab, edit, then save it to the editor." },
];

export default function GeneratorPage() {
  const { slug } = useParams();
  const prompt = PROMPT_GENERATORS.find((g) => g.slug === slug);
  const known = !!prompt || slug === "git-diagrammer" || slug === "file-to-diagram";

  useEffect(() => {
    if (prompt) document.title = `${prompt.metaTitle}: free and editable | easydraw`;
    else if (slug === "git-diagrammer") document.title = "Git diagrammer: diagram any public GitHub repo | easydraw";
    else if (slug === "file-to-diagram") document.title = "File to diagram: SQL, Terraform and docker-compose | easydraw";
  }, [prompt, slug]);

  if (!known) return <NotFoundPage />;

  let hero: { eyebrow: string; title: string; sub: string };
  let body: React.ReactNode;
  let faq: { q: string; a: React.ReactNode }[];
  let path: string;

  if (prompt) {
    hero = { eyebrow: prompt.title, title: prompt.h1, sub: prompt.sub };
    body = <DiagramTool key={prompt.slug} lockedType={prompt.type} examples={prompt.examples} storageKey={`easydraw.gen.${prompt.slug}`} placeholder={prompt.placeholder} />;
    faq = [...prompt.faq, ...COMMON_FAQ];
    path = `/ai/${prompt.slug}`;
  } else if (slug === "git-diagrammer") {
    hero = {
      eyebrow: "Git diagrammer",
      title: "See the shape of any public repo",
      sub: "Paste a GitHub repository URL and get an architecture diagram of its folders, services and entry points.",
    };
    body = <RepoTool />;
    faq = REPO_FAQ;
    path = "/ai/git-diagrammer";
  } else {
    hero = {
      eyebrow: "File to diagram",
      title: "Turn SQL, Terraform and compose files into diagrams",
      sub: "Drop in a schema, an infrastructure file or a docker-compose.yml. The conversion runs in your browser, and nothing is uploaded.",
    };
    body = <FileTool />;
    faq = FILE_FAQ;
    path = "/ai/file-to-diagram";
  }

  return (
    <>
      <ToolHero {...hero} />
      <Container className="py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          {body}
          <ToolSection title="Frequently asked questions">
            <ToolFaq items={faq} />
          </ToolSection>
        </div>
        <ToolSection title="More free tools">
          <ToolsGrid exclude={path} />
        </ToolSection>
      </Container>
    </>
  );
}
