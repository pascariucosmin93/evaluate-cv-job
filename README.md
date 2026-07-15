# Evaluate CV Job

Aplicatie full-stack fara baza de date pentru evaluarea compatibilitatii dintre un CV si un job description.

## Structura

- `frontend` - aplicatie Next.js pentru input si afisarea rezultatului
- `backend` - API Node.js + Express care calculeaza scorul de potrivire
- `.github/workflows/docker-images.yml` - pipeline pentru build si push imagini Docker

## Cum functioneaza

Backend-ul primeste:

- textul din CV
- textul din job description
- optional un job title

Si returneaza:

- `matchScore` in procente
- verdict
- puncte forte
- lipsuri
- scoruri pe categorii
- recomandari concrete

## Container images

Sunt doua imagini separate:

- `frontend`
- `backend`

Workflow-ul de GitHub Actions este pregatit pentru `GHCR`. Pentru alt registry, schimbi doar variabilele din workflow.

## Integrare GitOps

Nu am inclus manifeste Kubernetes. Repo-ul este pregatit sa fie consumat de un repo separat de GitOps care referentiaza imaginile rezultate din pipeline.

