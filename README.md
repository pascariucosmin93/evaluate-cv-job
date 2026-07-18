# Evaluate CV Job

Aplicatie full-stack fara baza de date pentru evaluarea compatibilitatii dintre un CV si un job description, cu detectare automata a domeniului profesional.

## Structura

- `frontend` - aplicatie Next.js pentru input si afisarea rezultatului
- `backend` - API Node.js + Express care calculeaza scorul de potrivire
- `.github/workflows/docker-images.yml` - pipeline pentru build si push imagini Docker
- `.github/workflows/promote-production.yml` - workflow manual care actualizeaza repo-ul GitOps la ultimul tag Docker

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

## GitOps Cu Argo CD

Argo CD trebuie sa urmareasca doar repo-ul GitOps:

- `git@github.com:pascariucosmin93/evaluate-cv-job-gitops.git`

Fluxul recomandat este:

1. faci push in repo-ul aplicatiei
2. workflow-ul `docker-images` construieste si publica imaginile
3. acelasi workflow actualizeaza tag-urile de imagine in repo-ul GitOps
4. Argo CD detecteaza schimbarea din repo-ul GitOps si face sync in cluster

Workflow-ul manual `.github/workflows/promote-production.yml` exista doar ca fallback ca sa rescrie repo-ul GitOps la ultimul tag Docker publicat.

Secrets necesare in GitHub:

- `GITOPS_REPO_SSH_KEY`
Acest secret trebuie sa contina cheia privata care poate face push in repo-ul `evaluate-cv-job-gitops`.

Ca sa rulezi promovarea manuala:

1. mergi in GitHub Actions
2. deschizi workflow-ul `promote-production`
3. apesi `Run workflow`

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
