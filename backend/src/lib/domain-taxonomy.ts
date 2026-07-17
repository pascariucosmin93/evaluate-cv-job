export type DomainDefinition = {
  key: string;
  label: string;
  aliases: string[];
  roles: string[];
  tools: string[];
  activities: string[];
};

export const DOMAIN_TAXONOMY: DomainDefinition[] = [
  {
    key: "software-engineering",
    label: "Software Engineering",
    aliases: ["software", "application", "web", "mobile", "backend", "frontend"],
    roles: ["software engineer", "developer", "programmer", "backend engineer", "frontend engineer", "full stack", "fullstack", "qa engineer", "tester"],
    tools: ["javascript", "typescript", "python", "java", "c#", "react", "next.js", "node.js", "sql", "git", "api"],
    activities: ["develop", "build applications", "debug", "implement features", "write code", "test automation"]
  },
  {
    key: "devops-cloud",
    label: "DevOps / Cloud",
    aliases: ["cloud", "platform", "infrastructure", "sre", "site reliability"],
    roles: ["devops engineer", "platform engineer", "cloud engineer", "site reliability engineer", "system administrator", "sysadmin"],
    tools: ["docker", "kubernetes", "terraform", "aws", "azure", "linux", "jenkins", "github actions", "monitoring", "prometheus"],
    activities: ["automate deployments", "manage infrastructure", "maintain uptime", "incident response", "ci/cd", "observability"]
  },
  {
    key: "construction-trades",
    label: "Constructii si meserii",
    aliases: ["construction", "building", "renovation", "santier", "lucrari"],
    roles: ["zidar", "mason", "constructor", "carpenter", "dulgher", "electrician", "plumber", "instalator", "sudor", "welder", "painter"],
    tools: ["beton", "caramida", "morter", "rigips", "schela", "gresie", "faianta", "cabling", "welding"],
    activities: ["montaj", "turnare", "zidarie", "renovare", "citire plan", "finisaje", "instalatii"]
  },
  {
    key: "sales-customer-service",
    label: "Vanzari si relatii clienti",
    aliases: ["sales", "retail", "customer", "client", "commerce"],
    roles: ["sales representative", "account manager", "cashier", "casier", "customer support", "call center", "store manager"],
    tools: ["crm", "salesforce", "zendesk", "pos", "upselling", "lead generation"],
    activities: ["sell", "close deals", "customer support", "handle complaints", "follow up", "client acquisition"]
  },
  {
    key: "finance-accounting",
    label: "Finante si contabilitate",
    aliases: ["finance", "accounting", "bookkeeping", "audit", "tax"],
    roles: ["accountant", "contabil", "financial analyst", "auditor", "bookkeeper", "payroll specialist"],
    tools: ["excel", "erp", "sap", "quickbooks", "invoices", "balance sheet", "tax reporting"],
    activities: ["reconcile", "prepare reports", "manage invoices", "budgeting", "financial analysis", "month-end closing"]
  },
  {
    key: "healthcare",
    label: "Sanatate",
    aliases: ["medical", "clinic", "hospital", "patient", "healthcare"],
    roles: ["doctor", "medic", "nurse", "asistent medical", "caregiver", "pharmacist", "terapeut"],
    tools: ["triage", "patient records", "medication", "vital signs", "sterilization"],
    activities: ["patient care", "administer treatment", "monitor patients", "medical documentation", "clinical support"]
  },
  {
    key: "education-training",
    label: "Educatie si training",
    aliases: ["education", "school", "training", "learning", "curriculum"],
    roles: ["teacher", "profesor", "instructor", "trainer", "educator", "tutor"],
    tools: ["lesson plan", "classroom", "assessment", "course material", "e-learning"],
    activities: ["teach", "prepare lessons", "evaluate students", "deliver training", "mentor learners"]
  },
  {
    key: "logistics-operations",
    label: "Logistica si operatiuni",
    aliases: ["logistics", "warehouse", "transport", "operations", "supply chain"],
    roles: ["dispatcher", "warehouse worker", "logistics coordinator", "forklift operator", "driver", "curier"],
    tools: ["inventory", "shipment", "warehouse management", "route planning", "forklift", "picking"],
    activities: ["deliver", "load goods", "track inventory", "coordinate transport", "prepare orders"]
  },
  {
    key: "hospitality-food",
    label: "HoReCa",
    aliases: ["restaurant", "hotel", "hospitality", "food service", "catering"],
    roles: ["waiter", "ospatar", "bartender", "cook", "chef", "receptionist", "housekeeper"],
    tools: ["reservation system", "food safety", "menu", "cash register", "barista"],
    activities: ["serve guests", "prepare food", "manage reservations", "clean rooms", "handle orders"]
  },
  {
    key: "administration-hr",
    label: "Administrativ si HR",
    aliases: ["administration", "office", "hr", "human resources", "recruitment"],
    roles: ["office manager", "administrative assistant", "recruiter", "hr specialist", "secretary"],
    tools: ["microsoft office", "excel", "payroll", "recruitment", "scheduling", "documentation"],
    activities: ["schedule meetings", "maintain records", "recruit candidates", "onboard employees", "office support"]
  }
];
