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

type TailoredCvResponse = {
  jobTitle: string | null;
  tailoredCv: string;
  changesSummary: string[];
  notes: string[];
  addedSkills: string[];
  rejectedSkills: string[];
  blocked: boolean;
  blockReason: string | null;
};

const BREAKDOWN_LABELS: Record<keyof Breakdown, string> = {
  skills: "Skill match",
  experience: "Experienta relevanta",
  seniority: "Nivel / seniority",
  domain: "Domeniu tehnic",
  communication: "Colaborare"
};

async function extractTextFromPdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdf-worker";

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument(data).promise;
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

function slugifyFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function sanitizePdfText(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/\u00A0/g, " ")
    .replace(/ă/g, "a")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ş/g, "s")
    .replace(/ț/g, "t")
    .replace(/ţ/g, "t")
    .replace(/Ă/g, "A")
    .replace(/Â/g, "A")
    .replace(/Î/g, "I")
    .replace(/Ș/g, "S")
    .replace(/Ş/g, "S")
    .replace(/Ț/g, "T")
    .replace(/Ţ/g, "T");
}

function wrapTextForPdf(text: string, maxLineLength = 92) {
  const sourceLines = sanitizePdfText(text).replace(/\r/g, "").split("\n");
  const wrappedLines: string[] = [];

  for (const sourceLine of sourceLines) {
    const normalizedLine = sourceLine.trimEnd();

    if (!normalizedLine) {
      wrappedLines.push("");
      continue;
    }

    let currentLine = "";
    const words = normalizedLine.split(/\s+/);

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (candidate.length <= maxLineLength) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        wrappedLines.push(currentLine);
      }

      currentLine = word;
    }

    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }

  return wrappedLines;
}

function buildPdfBlob(text: string) {
  const lines = wrapTextForPdf(text);
  const linesPerPage = 44;
  const pageWidth = 595;
  const pageHeight = 842;
  const fontSize = 11;
  const lineHeight = 16;
  const leftMargin = 48;
  const topStart = 790;
  const pages: string[] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    const pageLines = lines.slice(index, index + linesPerPage);
    const contentLines = ["BT", `/F1 ${fontSize} Tf`];

    pageLines.forEach((line, lineIndex) => {
      const y = topStart - lineIndex * lineHeight;
      contentLines.push(`1 0 0 1 ${leftMargin} ${y} Tm (${escapePdfText(line)}) Tj`);
    });

    contentLines.push("ET");
    pages.push(contentLines.join("\n"));
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const contentObjectIds = pages.map((page) =>
    addObject(`<< /Length ${page.length} >>\nstream\n${page}\nendstream`)
  );

  const pageObjectIds = contentObjectIds.map((contentObjectId) =>
    addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    )
  );

  const pagesObjectId = addObject(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`
  );

  pageObjectIds.forEach((pageObjectId, index) => {
    objects[pageObjectId - 1] = objects[pageObjectId - 1].replace("/Parent 0 0 R", `/Parent ${pagesObjectId} 0 R`);
  });

  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export default function Home() {
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [cv, setCv] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [hasUploadedCv, setHasUploadedCv] = useState(false);
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [tailoredCvResult, setTailoredCvResult] = useState<TailoredCvResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
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
    setHasUploadedCv(false);
    setResult(null);
    setTailoredCvResult(null);

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
          "PDF-ul a fost incarcat, dar nu am putut extrage suficient text din el pentru evaluare."
        );
      }

      setCv(text);
      setCvFileName(file.name);
      setHasUploadedCv(true);
    } catch (fileError) {
      setError(
        fileError instanceof Error
          ? fileError.message
          : "Nu am putut citi PDF-ul incarcat."
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
    setTailoredCvResult(null);

    if (!hasUploadedCv || !cv) {
      setIsLoading(false);
      setError("Incarca un CV PDF valid inainte sa calculezi potrivirea.");
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

  async function handleTailorCv() {
    setError("");

    if (!hasUploadedCv || !cv) {
      setError("Incarca un CV PDF valid inainte sa generezi varianta adaptata.");
      return;
    }

    if (jobDescription.trim().length < 50) {
      setError("Adauga un job description suficient de clar inainte sa adaptezi CV-ul.");
      return;
    }

    setIsTailoring(true);

    try {
      const response = await fetch(`${apiBaseUrl}/v1/tailor-cv`, {
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

      const payload = (await response.json()) as TailoredCvResponse;
      setTailoredCvResult(payload);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nu am putut genera CV-ul adaptat."
      );
    } finally {
      setIsTailoring(false);
    }
  }

  function handleDownloadTailoredCv() {
    if (!tailoredCvResult || tailoredCvResult.blocked) {
      return;
    }

    const cvName = cvFileName ? cvFileName.replace(/\.[^.]+$/, "") : "cv";
    const jobName = jobTitle.trim() || tailoredCvResult.jobTitle || "job";
    const fileName = `${slugifyFilePart(cvName)}-${slugifyFilePart(jobName)}-tailored.pdf`;
    const blob = buildPdfBlob(tailoredCvResult.tailoredCv);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
            Incarci CV-ul ca PDF, adaugi job description-ul ca text, iar
            aplicatia extrage continutul CV-ului si calculeaza potrivirea.
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
                accept=".pdf,application/pdf"
                onChange={handleCvFileChange}
              />
              <p className={styles.fieldHint}>
                Incarca CV-ul ca fisier `.pdf`. Textul este extras automat pentru analiza.
              </p>
              {isReadingFile ? (
                <p className={styles.fileStatus}>Extrag textul din PDF...</p>
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
              disabled={isLoading || isReadingFile || isTailoring}
            >
              {isLoading ? "Evaluez..." : "Calculeaza potrivirea"}
            </button>

            <button
              className={styles.secondaryButton}
              type="button"
              disabled={isLoading || isReadingFile || isTailoring}
              onClick={handleTailorCv}
            >
              {isTailoring ? "Generez CV-ul adaptat..." : "Genereaza CV adaptat pe JD"}
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
                    <p className={styles.scoreHint}>
                      Scorul combina acoperirea cerintelor tehnice, experienta,
                      senioritatea, domeniul si semnalele de colaborare.
                    </p>
                  </div>
                  <span className={styles.badge}>{verdictLabel}</span>
                </div>

                <p className={styles.summary}>{result.summary}</p>

                <div className={styles.breakdown}>
                  {Object.entries(result.breakdown).map(([key, value]) => (
                    <div className={styles.metric} key={key}>
                      <span>{BREAKDOWN_LABELS[key as keyof Breakdown]}</span>
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
                <p>
                  Separat, poti cere si o varianta de CV adaptata pe JD, fara sa
                  rescrii complet documentul.
                </p>
              </div>
            )}

            {tailoredCvResult ? (
              <div className={styles.tailorSection}>
                <div className={styles.tailorHeader}>
                  <div>
                    <h3>CV adaptat de AI</h3>
                    <p className={styles.tailorIntro}>
                      {tailoredCvResult.blocked
                        ? tailoredCvResult.blockReason || "Generarea CV-ului adaptat a fost oprita."
                        : "AI-ul a pastrat structura CV-ului si a incercat sa schimbe doar wording-ul relevant pentru acest JD."}
                    </p>
                  </div>

                  {!tailoredCvResult.blocked ? (
                    <button
                      type="button"
                      className={styles.downloadButton}
                      onClick={handleDownloadTailoredCv}
                    >
                      Download CV AI
                    </button>
                  ) : null}
                </div>

                <div className={styles.columns}>
                  <div>
                    <h3>Schimbari facute</h3>
                    <ul>
                      {tailoredCvResult.changesSummary.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3>Atentie</h3>
                    <ul>
                      {tailoredCvResult.notes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={styles.columns}>
                  <div>
                    <h3>Skill-uri adaugate</h3>
                    <div className={styles.tags}>
                      {tailoredCvResult.addedSkills.map((item) => (
                        <span className={styles.tag} key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3>Skill-uri neadaugate</h3>
                    <div className={styles.tags}>
                      {tailoredCvResult.rejectedSkills.map((item) => (
                        <span className={styles.tagWarning} key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {!tailoredCvResult.blocked ? (
                  <div className={styles.tailorGrid}>
                    <div>
                      <p className={styles.mutedLabel}>CV original</p>
                      <textarea
                        readOnly
                        value={cv}
                        rows={16}
                        className={styles.tailorArea}
                      />
                    </div>

                    <div>
                      <p className={styles.mutedLabel}>CV propus de AI</p>
                      <textarea
                        readOnly
                        value={tailoredCvResult.tailoredCv}
                        rows={16}
                        className={styles.tailorArea}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </section>
      </main>
    </div>
  );
}
