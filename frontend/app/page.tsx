"use client";

import { FormEvent, useMemo, useState } from "react";
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

export default function Home() {
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [cv, setCv] = useState("");
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const apiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
    []
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

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
            Introduci CV-ul si JD-ul, iar aplicatia iti da un scor de potrivire,
            gap-urile principale si ce sa corectezi inainte de aplicare.
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
              <label htmlFor="cv">CV</label>
              <textarea
                id="cv"
                placeholder="Lipeste aici CV-ul tau..."
                value={cv}
                onChange={(event) => setCv(event.target.value)}
                rows={14}
              />
            </div>

            <button
              className={styles.primaryButton}
              type="submit"
              disabled={isLoading}
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
