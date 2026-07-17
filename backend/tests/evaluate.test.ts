import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMatch } from "../src/lib/evaluate.js";

test("matches DevOps CV with DevOps job", () => {
  const result = evaluateMatch(
    "Senior DevOps Engineer role. Required: Kubernetes, Terraform, AWS, CI/CD, incident response, monitoring and 5 years experience.",
    "Senior DevOps engineer with 6 years experience in AWS, Kubernetes, Terraform, Docker, CI/CD pipelines, monitoring and incident response."
  );

  assert.equal(result.detectedJobDomain.key, "devops-cloud");
  assert.equal(result.detectedCvDomain.key, "devops-cloud");
  assert.equal(result.domainMismatch, false);
  assert.equal(result.verdict, "strong-fit");
  assert.ok(result.matchScore >= 75);
});

test("rejects strong scoring for different professions", () => {
  const result = evaluateMatch(
    "Cautam zidar pentru santier rezidential. Cerinte: zidarie, finisaje, citire plan, turnare beton si lucru pe schela.",
    "DevOps engineer cu experienta in AWS, Kubernetes, Terraform, Linux, monitoring si automatizare CI/CD."
  );

  assert.equal(result.detectedJobDomain.key, "construction-trades");
  assert.equal(result.detectedCvDomain.key, "devops-cloud");
  assert.equal(result.domainMismatch, true);
  assert.equal(result.verdict, "weak-fit");
  assert.ok(result.matchScore <= 20);
});

test("recognizes construction profiles", () => {
  const result = evaluateMatch(
    "Angajam zidar pentru lucrari de zidarie, renovare, finisaje, montaj rigips si lucru pe santier.",
    "Zidar cu 8 ani experienta in zidarie, renovare, rigips, finisaje, turnare beton si citire plan."
  );

  assert.equal(result.detectedJobDomain.key, "construction-trades");
  assert.equal(result.detectedCvDomain.key, "construction-trades");
  assert.equal(result.domainMismatch, false);
  assert.ok(result.matchScore >= 70);
});

test("recognizes finance and accounting profiles", () => {
  const result = evaluateMatch(
    "Contabil pentru rapoarte financiare, reconciliere, facturi, Excel, ERP si inchidere de luna.",
    "Contabil cu 4 ani experienta in facturi, reconciliere, Excel, ERP, rapoarte financiare si payroll."
  );

  assert.equal(result.detectedJobDomain.key, "finance-accounting");
  assert.equal(result.detectedCvDomain.key, "finance-accounting");
  assert.equal(result.domainMismatch, false);
  assert.ok(result.matchScore >= 65);
});

test("recognizes education versus logistics mismatch", () => {
  const result = evaluateMatch(
    "Profesor de limba engleza. Cerinte: lesson plan, classroom management, evaluare elevi si training.",
    "Warehouse worker cu experienta in shipment, inventory, forklift, pregatire comenzi si coordonare transport."
  );

  assert.equal(result.detectedJobDomain.key, "education-training");
  assert.equal(result.detectedCvDomain.key, "logistics-operations");
  assert.equal(result.domainMismatch, true);
  assert.ok(result.matchScore <= 20);
});
