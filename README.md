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

## Pornire Locala Cu Docker

Proiectul poate porni ca stack complet cu:

```bash
docker compose up --build
```

Servicii pornite:

- `frontend` pe `http://localhost:3000`
- `backend` pe `http://localhost:8080`
- `ollama` pe `http://localhost:11434`

La primul start, serviciul `ollama-pull` descarca automat modelul configurat prin `OLLAMA_MODEL`. Implicit foloseste `llama3.1:8b`, deci primul boot poate dura cateva minute.

Ca sa alegi alt model:

```bash
OLLAMA_MODEL=qwen2.5:7b docker compose up --build
```

## Integrare GitOps

Nu am inclus manifeste Kubernetes. Repo-ul este pregatit sa fie consumat de un repo separat de GitOps care referentiaza imaginile rezultate din pipeline.
