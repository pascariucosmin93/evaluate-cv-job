"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type Breakdown = {
  skills: number;
  experience: number;
  seniority: number;
  domain: number;
  communication: number;
};

type EvaluationResponse = {
  jobTitle: string | null;
  matchScore: number;
  verdict: "strong-fit" | "partial-fit" | "weak-fit";
  summary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  risks: string[];
  recommendations: string[];
  breakdown: Breakdown;
};

async function extractTextFromPdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages = await Promise.all(
    Array.from({ length: document.numPages }, async (_, index) => {
      const page = await document.getPage(index + 1);
      const content = await page.getTextContent();

      return content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();
    })
  );

  return pages.join("\n\n").trim();
}

export default function Home() {
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [cv, setCv] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const apiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
    []
  );

  async function handleCvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setError("");
    setCv("");
    setCvFileName("");

    if (!file) {
      return;
    }

    const fileName = file.name.toLowerCase();
    const isPdfFile =
      file.type === "application/pdf" || fileName.endsWith(".pdf");
    const unsupportedBinaryFile =
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".doc") ||
      fileName.endsWith(".docx");

    if (unsupportedBinaryFile) {
      setError(
        "Momentan poti incarca CV-uri .pdf, .txt, .md sau .rtf. DOC si DOCX nu sunt inca suportate."
      );
      event.target.value = "";
      return;
    }

    setIsReadingFile(true);

    try {
      const text = isPdfFile ? await extractTextFromPdf(file) : await file.text();

      if (text.trim().length < 50) {
        throw new Error(
          "Fisierul incarcat nu contine suficient text pentru evaluare."
        );
      }

      setCv(text);
      setCvFileName(file.name);
    } catch (fileError) {
      setError(
        fileError instanceof Error
          ? fileError.message
          : "Nu am putut citi fisierul incarcat."
      );
      event.target.value = "";
    } finally {
      setIsReadingFile(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    if (!cv) {
      setIsLoading(false);
      setError("Incarca mai intai CV-ul in format text.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/v1/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobTitle: jobTitle.trim() || undefined,
          jobDescription,
          cv,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Request failed.");
      }

      const payload = (await response.json()) as EvaluationResponse;
      setResult(payload);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nu am putut evalua compatibilitatea."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const verdictLabel =
    result?.verdict === "strong-fit"
      ? "Fit bun"
      : result?.verdict === "partial-fit"
        ? "Fit partial"
        : "Fit slab";

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>CV x Job Description</p>
          <h1>Afla rapid daca merita sa aplici.</h1>
          <p className={styles.subtitle}>
            Incarci CV-ul si adaugi JD-ul, iar aplicatia iti da un scor de
            potrivire, gap-urile principale si ce sa corectezi inainte de
            aplicare.
          </p>
        </section>

        <section className={styles.grid}>
          <form className={styles.formCard} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="jobTitle">Titlu job</label>
              <input
                id="jobTitle"
                type="text"
                placeholder="Senior Backend Engineer"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="jobDescription">Job description</label>
              <textarea
                id="jobDescription"
                placeholder="Lipeste aici cerintele rolului..."
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                rows={14}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="cvFile">CV upload</label>
              <input
                id="cvFile"
                type="file"
                accept=".pdf,.txt,.md,.rtf,application/pdf,text/plain,text/markdown,application/rtf"
                onChange={handleCvFileChange}
              />
              <p className={styles.fieldHint}>
                Incarca un CV `.pdf`, `.txt`, `.md` sau `.rtf`.
              </p>
              {isReadingFile ? (
                <p className={styles.fileStatus}>Citesc fisierul incarcat...</p>
              ) : null}
              {cvFileName ? (
                <div className={styles.uploadSummary}>
                  <strong>{cvFileName}</strong>
                  <span>{cv.trim().length} caractere extrase pentru analiza.</span>
                </div>
              ) : null}
              <textarea
                value={cv}
                readOnly
                rows={10}
                className={styles.previewArea}
                placeholder="Preview-ul textului extras din CV apare aici dupa upload."
              />
            </div>

            <button
              className={styles.primaryButton}
              type="submit"
              disabled={isLoading || isReadingFile}
            >
              {isLoading ? "Evaluez..." : "Calculeaza potrivirea"}
            </button>

            {error ? <p className={styles.error}>{error}</p> : null}
          </form>

          <section className={styles.resultCard}>
            {result ? (
              <>
                <div className={styles.scoreHeader}>
                  <div>
                    <p className={styles.mutedLabel}>Scor general</p>
                    <h2>{result.matchScore}%</h2>
                  </div>
                  <span className={styles.badge}>{verdictLabel}</span>
                </div>

                <p className={styles.summary}>{result.summary}</p>

                <div className={styles.breakdown}>
                  {Object.entries(result.breakdown).map(([key, value]) => (
                    <div className={styles.metric} key={key}>
                      <span>{key}</span>
                      <strong>{value}%</strong>
                    </div>
                  ))}
                </div>

                <div className={styles.columns}>
                  <div>
                    <h3>Puncte forte</h3>
                    <ul>
                      {result.strengths.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3>Riscuri</h3>
                    <ul>
                      {result.risks.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={styles.columns}>
                  <div>
                    <h3>Se potrivesc</h3>
                    <div className={styles.tags}>
                      {result.matchedKeywords.length > 0 ? (
                        result.matchedKeywords.map((item) => (
                          <span className={styles.tag} key={item}>
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className={styles.empty}>
                          Nu am detectat termeni comuni relevanti.
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3>Lipsesc</h3>
                    <div className={styles.tags}>
                      {result.missingKeywords.length > 0 ? (
                        result.missingKeywords.map((item) => (
                          <span className={styles.tagWarning} key={item}>
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className={styles.empty}>
                          Nu apar gap-uri evidente pe keyword-uri.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3>Recomandari</h3>
                  <ul className={styles.recommendations}>
                    {result.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className={styles.placeholder}>
                <p className={styles.mutedLabel}>Rezultatul apare aici</p>
                <h2>Scorul de compatibilitate</h2>
                <p>
                  Dupa submit vei vedea scorul, breakdown-ul si principalele
                  gap-uri dintre CV si cerintele rolului.
                </p>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
