/** TypeScript mirror of `.specs/plan-implementation/API_CONTRACT.md`. */

// ---------------------------------------------------------------------------
// Linguistic values
// ---------------------------------------------------------------------------

/** Individual risk term r* ∈ {L, BA, A, AA, H} (low → high risk). */
export type RiskTerm = 'L' | 'BA' | 'A' | 'AA' | 'H'

/** Expert safety level Δ₁..Δ₅. */
export type DeltaLevel = 'D1' | 'D2' | 'D3' | 'D4' | 'D5'

/** Final linguistic risk class R₁..R₅. */
export type RiskClass = 'R1' | 'R2' | 'R3' | 'R4' | 'R5'

export const RISK_TERMS: readonly RiskTerm[] = ['L', 'BA', 'A', 'AA', 'H']
export const DELTA_LEVELS: readonly DeltaLevel[] = ['D1', 'D2', 'D3', 'D4', 'D5']
export const RISK_CLASSES: readonly RiskClass[] = ['R1', 'R2', 'R3', 'R4', 'R5']

// ---------------------------------------------------------------------------
// Conventions
// ---------------------------------------------------------------------------

export interface ListResponse<T> {
  items: T[]
  total: number
}

export interface PageParams {
  offset?: number
  limit?: number
}

// ---------------------------------------------------------------------------
// Health & meta
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string
}

export interface MetaResponse {
  app_version: string
  core_version: string
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export interface LatestResult {
  mu: number
  risk_class: RiskClass
  evaluated_at: string
}

export interface Region {
  id: number
  name_uk: string
  name_en: string
  xi: number | null
  delta_level: DeltaLevel | null
  respondent_count: number
  latest_result: LatestResult | null
}

export interface RegionCreate {
  name_uk: string
  name_en: string
  xi?: number | null
  delta_level?: DeltaLevel | null
}

export interface RegionUpdate {
  name_uk?: string
  name_en?: string
  xi?: number | null
  delta_level?: DeltaLevel | null
}

// ---------------------------------------------------------------------------
// Respondents (questionnaires)
// ---------------------------------------------------------------------------

/** Ratings are a map keyed by criterion code: {"K11": 4, ..., "K35": 2}. */
export type Ratings = Record<string, number>

/**
 * Year/month are free-text strings: imported questionnaires hold values like
 * «2021 рік» or «Липень», and the backend stores/filters them verbatim.
 */
export interface Respondent {
  id: number
  ext_id: string | null
  year: string | null
  month: string | null
  accommodation: string | null
  ratings: Ratings
}

export interface RespondentCreate {
  ext_id?: string | null
  year?: string | null
  month?: string | null
  accommodation?: string | null
  ratings: Ratings
}

export type RespondentUpdate = Partial<RespondentCreate>

export interface RespondentFilters extends PageParams {
  year?: string
  month?: string
  accommodation?: string
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ImportRowError {
  row: number
  message: string
}

export interface ImportReport {
  imported: number
  skipped: number
  created_regions: Region[]
  errors: ImportRowError[]
}

// ---------------------------------------------------------------------------
// Criteria configuration
// ---------------------------------------------------------------------------

export interface Criterion {
  code: string
  text_uk: string
  text_en: string
}

export interface CriteriaGroup {
  id: number
  code: string
  name_uk: string
  name_en: string
  criteria: Criterion[]
}

export interface CriteriaConfig {
  groups: CriteriaGroup[]
}

export interface CriteriaGroupInput {
  code: string
  name_uk: string
  name_en: string
  criteria: Criterion[]
}

export interface CriteriaConfigInput {
  groups: CriteriaGroupInput[]
}

// ---------------------------------------------------------------------------
// Platform configuration (versioned)
// ---------------------------------------------------------------------------

export interface ConfigParams {
  term_multipliers: number[]
  chi_scale: Record<RiskTerm, number>
  z_spline: { a: number; b: number }
  cone: { base: [number, number]; scale: [number, number] }
  fuzzification_boundaries: number[]
  risk_thresholds: number[]
}

export interface ConfigVersion {
  version: number
  created_at: string
  active: boolean
  comment: string | null
  params: ConfigParams
}

export interface ConfigCreate {
  params: ConfigParams
  comment?: string | null
}

/** Plot data sampled from the core library. Points are [x, y] pairs. */
export interface CurvesResponse {
  z_spline: [number, number][]
  s_shape: [number, number][]
  cone: {
    xi_fixed: [number, number][]
    phi_fixed: [number, number][]
  }
}

// ---------------------------------------------------------------------------
// Rule sets (M_R1 If–Then builder)
// ---------------------------------------------------------------------------

export interface Rule {
  /** Minimum term levels (1–5), one slot per criteria group at most. */
  pattern: number[]
  output: RiskTerm
}

export interface RuleSetVersion {
  version: number
  active: boolean
  created_at: string
  comment: string | null
  rules: Rule[]
  default_output: RiskTerm
}

export interface RuleSetCreate {
  rules: Rule[]
  default_output: RiskTerm
  comment?: string | null
}

// ---------------------------------------------------------------------------
// Evaluation (the T₅ operator run)
// ---------------------------------------------------------------------------

export interface RegionRef {
  id: number
  name_uk: string
  name_en: string
}

export interface RegionResult {
  region: RegionRef
  n: number
  xi: number
  delta_level: DeltaLevel
  delta: number
  phi: number
  m_s: number
  omega: number
  mu: number
  risk_class: RiskClass
  r_star_distribution: Record<RiskTerm, number>
}

export interface RulesetSnapshot {
  rules: Rule[]
  default_output: RiskTerm
}

/** Config params as persisted on a run, annotated with the source version. */
export interface ConfigSnapshot extends ConfigParams {
  /** Absent on runs created before version traceability was added. */
  version?: number
}

export interface EvaluationRun {
  id: number
  created_at: string
  comment: string | null
  config_snapshot: ConfigSnapshot
  ruleset_snapshot: RulesetSnapshot
  results: RegionResult[]
}

/** History list items (no per-individual data). */
export interface EvaluationListItem {
  id: number
  created_at: string
  comment: string | null
  results?: RegionResult[]
}

export interface EvaluationCreate {
  /** null = evaluate all regions. */
  region_ids: number[] | null
  comment?: string | null
}

/** Per-respondent intermediates of one region in one run. */
export interface IndividualResult {
  respondent_id: number
  ext_id: string | null
  /** Group sums θ_g keyed by group code: {"G1": 13, ...}. */
  theta: Record<string, number>
  /** Group term levels 1–5 keyed by group code: {"G1": 3, ...}. */
  terms: Record<string, number>
  r_star: RiskTerm
  chi: number
}

export type ExportFormat = 'xlsx' | 'pdf'
export type Lang = 'uk' | 'en'
