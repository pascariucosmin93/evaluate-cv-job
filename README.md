# Evaluate CV Job

Aplicatie full-stack fara baza de date pentru evaluarea compatibilitatii dintre un CV si un job description, cu detectare automata a domeniului profesional.

## Structura

- `frontend` - aplicatie Next.js pentru input si afisarea rezultatului
- `backend` - API Node.js + Express care calculeaza scorul de potrivire
- `.github/workflows/docker-images.yml` - pipeline pentru build si push imagini Docker
- `.github/workflows/promote-production.yml` - pipeline manual pentru promovare in productie pe tag-ul `latest`

## Cum functioneaza

Backend-ul primeste:

- textul din CV
- textul din job description
- optional un job title

Si returneaza:

- `matchScore` in procente
- verdict
- domeniul detectat pentru CV si job
- puncte forte
- lipsuri
- scoruri pe categorii
- recomandari concrete

## Container images

Sunt doua imagini separate:

- `frontend`
- `backend`

Workflow-ul de GitHub Actions este pregatit pentru `GHCR`. Pentru alt registry, schimbi doar variabilele din workflow.

## Promovare In Productie

Exista un workflow separat de promovare:

- `.github/workflows/promote-production.yml`

Acesta:

- copiaza [deploy/docker-compose.production.yml](/home/cosmin/evaluate-cv-job/deploy/docker-compose.production.yml:1) pe serverul de productie
- face `docker login` in `GHCR`
- ruleaza `docker compose pull`
- ruleaza `docker compose up -d`
- foloseste imaginile `ghcr.io/pascariucosmin93/evaluate-cv-job-frontend:latest`
- foloseste imaginile `ghcr.io/pascariucosmin93/evaluate-cv-job-backend:latest`

Secrets necesare in GitHub:

- `PROD_SSH_HOST`
- `PROD_SSH_PORT`
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_DEPLOY_PATH`
- `PROD_GHCR_USERNAME`
- `PROD_GHCR_TOKEN`
- `PROD_OLLAMA_MODEL` optional
- `PROD_OLLAMA_TIMEOUT_MS` optional
- `PROD_FRONTEND_PORT` optional
- `PROD_BACKEND_PORT` optional

Ca sa rulezi promovarea:

1. mergi in GitHub Actions
2. deschizi workflow-ul `promote-production`
3. apesi `Run workflow`
4. lasi confirmarea pe `latest`

## Pornire Locala Cu Docker

Proiectul poate porni ca stack complet cu:

```bash
docker compose up --build
```

Servicii pornite:

- `frontend` pe `http://localhost:3000`
- `backend` pe `http://localhost:8080`
- `ollama` pe `http://localhost:11434`

La primul start, serviciul `ollama-pull` descarca automat modelul configurat prin `OLLAMA_MODEL`. Implicit foloseste `llama3.1:8b`, deci primul boot poate dura cateva minute si are nevoie de mai multa memorie decat modelele de 1B sau 3B.

Ca sa alegi alt model:

```bash
OLLAMA_MODEL=llama3.2:3b docker compose up --build
```

## Integrare GitOps

Nu am inclus manifeste Kubernetes. Repo-ul este pregatit sa fie consumat de un repo separat de GitOps care referentiaza imaginile rezultate din pipeline.

## Evaluare Multi-Domeniu

Motorul de evaluare nu mai presupune ca orice CV sau job este din cloud sau DevOps.

- detecteaza domeniul principal pentru CV si job
- extrage cerinte relevante din domeniul detectat
- penalizeaza clar mismatch-ul dintre profesii diferite
- functioneaza pentru profiluri tehnice si non-tehnice, de exemplu `DevOps`, `contabil`, `profesor`, `zidar` sau `lucrator depozit`
