import type {
  AuthResponse,
  Competition,
  Evaluation,
  EvaluationParameter,
  JudgeAssignedPanel,
  LeaderboardResult,
  Panel,
  Participant,
  ParticipantEvaluationDetails,
  ParticipantProfile,
  ParticipantResults,
  ProgressReport,
  PublicCompetition,
  RegisterParticipantPayload,
  RegisterParticipantResponse,
  RoundIdentifier,
  RoundStatus,
  User,
  UserRole,
} from "../types/api";

const API_BASE = "/api/v1";

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem("karvaan_token");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    let data: any = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes("/auth/login")) {
        localStorage.removeItem("karvaan_token");
        localStorage.removeItem("karvaan_user");
        window.dispatchEvent(new Event("karvaan_auth_expired"));
      }

      let errorMessage =
        data?.error?.message ||
        data?.message ||
        `HTTP request failed with status ${response.status}`;

      if (data?.error?.details) {
        if (Array.isArray(data.error.details)) {
          const detailStrings = data.error.details
            .map((d: any) => d.message || (d.path ? `${d.path}: ${d.code}` : String(d)))
            .filter(Boolean);
          if (detailStrings.length > 0) {
            errorMessage = `${errorMessage}: ${detailStrings.join(", ")}`;
          }
        } else if (typeof data.error.details === "object") {
          const detailStrings = Object.entries(data.error.details)
            .map(([field, msg]) => `${field}: ${msg}`)
            .filter(Boolean);
          if (detailStrings.length > 0) {
            errorMessage = `${errorMessage}: ${detailStrings.join(", ")}`;
          }
        }
      }

      throw new Error(errorMessage);
    }

    return data as T;
  }

  // --- Auth Endpoints ---
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("karvaan_token", res.token);
    localStorage.setItem("karvaan_user", JSON.stringify(res.user));
    return res;
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>("/auth/me");
  }

  async getJudges(): Promise<{ judges: User[] }> {
    return this.request<{ judges: User[] }>("/auth/judges");
  }

  async provisionUser(userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    isActive?: boolean;
  }): Promise<{ user: User }> {
    return this.request<{ user: User }>("/auth/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  logout(): void {
    localStorage.removeItem("karvaan_token");
    localStorage.removeItem("karvaan_user");
  }

  // --- Competition Endpoints ---
  async getCompetitions(): Promise<{ competitions: Competition[] }> {
    return this.request<{ competitions: Competition[] }>("/competitions");
  }

  async getCompetition(competitionId: string): Promise<{ competition: Competition }> {
    return this.request<{ competition: Competition }>(`/competitions/${competitionId}`);
  }

  async createCompetition(data: {
    name: string;
    description?: string;
  }): Promise<{ competition: Competition }> {
    return this.request<{ competition: Competition }>("/competitions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCompetition(
    competitionId: string,
    data: Partial<Pick<Competition, "name" | "description" | "status">>,
  ): Promise<{ competition: Competition }> {
    return this.request<{ competition: Competition }>(`/competitions/${competitionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async updateRoundStatus(
    competitionId: string,
    round: RoundIdentifier,
    status: RoundStatus,
  ): Promise<{ rounds: Competition["rounds"] }> {
    return this.request<{ rounds: Competition["rounds"] }>(
      `/competitions/${competitionId}/rounds/${round}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status }),
      },
    );
  }

  async getProgressReport(competitionId: string): Promise<{ progress: ProgressReport }> {
    return this.request<{ progress: ProgressReport }>(
      `/competitions/${competitionId}/progress`,
    );
  }

  // --- Panel Endpoints ---
  async getPanels(competitionId: string): Promise<{ panels: Panel[] }> {
    return this.request<{ panels: Panel[] }>(`/competitions/${competitionId}/panels`);
  }

  async createPanel(
    competitionId: string,
    data: { name: string; description?: string; judges: string[] },
  ): Promise<{ panel: Panel }> {
    return this.request<{ panel: Panel }>(`/competitions/${competitionId}/panels`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePanel(
    competitionId: string,
    panelId: string,
    data: { name?: string; description?: string; judges?: string[]; isActive?: boolean },
  ): Promise<{ panel: Panel }> {
    return this.request<{ panel: Panel }>(
      `/competitions/${competitionId}/panels/${panelId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  }

  // --- Participant Endpoints ---
  async getParticipants(
    competitionId: string,
    params?: { panel?: string; isActive?: boolean; round?: RoundIdentifier },
  ): Promise<{ participants: Participant[] }> {
    const query = new URLSearchParams();
    if (params?.panel) query.append("panel", params.panel);
    if (params?.isActive !== undefined) query.append("isActive", String(params.isActive));
    if (params?.round !== undefined) query.append("round", String(params.round));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<{ participants: Participant[] }>(
      `/competitions/${competitionId}/participants${qs}`,
    );
  }

  async createParticipant(
    competitionId: string,
    data: { name: string; registrationId?: string; email?: string; panel?: string },
  ): Promise<{ participant: Participant }> {
    return this.request<{ participant: Participant }>(
      `/competitions/${competitionId}/participants`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async updateParticipant(
    competitionId: string,
    participantId: string,
    data: { name?: string; registrationId?: string; email?: string; panel?: string | null; isActive?: boolean },
  ): Promise<{ participant: Participant }> {
    return this.request<{ participant: Participant }>(
      `/competitions/${competitionId}/participants/${participantId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  }

  async updateEligibility(
    competitionId: string,
    participantId: string,
    data: { round: RoundIdentifier; eligible: boolean; ineligibleReason?: string },
  ): Promise<{ participant: Participant }> {
    return this.request<{ participant: Participant }>(
      `/competitions/${competitionId}/participants/${participantId}/eligibility`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  }

  async qualifyRound2(
    competitionId: string,
    data: { method: "explicit" | "topN" | "cutoffScore"; topN?: number; cutoffScore?: number; participantIds?: string[] },
  ): Promise<{ qualifiedCount: number; totalProcessed: number }> {
    return this.request<{ qualifiedCount: number; totalProcessed: number }>(
      `/competitions/${competitionId}/participants/qualify-round-2`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  // --- Parameter Endpoints ---
  async getParameters(
    competitionId: string,
    params?: { round?: RoundIdentifier; isActive?: boolean },
  ): Promise<{ parameters: EvaluationParameter[] }> {
    const query = new URLSearchParams();
    if (params?.round) query.append("round", String(params.round));
    if (params?.isActive !== undefined) query.append("isActive", String(params.isActive));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<{ parameters: EvaluationParameter[] }>(
      `/competitions/${competitionId}/parameters${qs}`,
    );
  }

  async createParameter(
    competitionId: string,
    data: {
      name: string;
      description?: string | null;
      guidelines?: string | null;
      maxMarks: number;
      weightage: number;
      applicableRounds: RoundIdentifier[];
      isActive?: boolean;
      priority?: number | null;
    },
  ): Promise<{ parameter: EvaluationParameter }> {
    return this.request<{ parameter: EvaluationParameter }>(
      `/competitions/${competitionId}/parameters`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async updateParameter(
    competitionId: string,
    parameterId: string,
    data: Partial<
      Pick<
        EvaluationParameter,
        | "name"
        | "description"
        | "guidelines"
        | "maxMarks"
        | "weightage"
        | "applicableRounds"
        | "isActive"
        | "priority"
      >
    >,
  ): Promise<{ parameter: EvaluationParameter }> {
    return this.request<{ parameter: EvaluationParameter }>(
      `/competitions/${competitionId}/parameters/${parameterId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  }

  // --- Evaluation Endpoints ---
  async saveEvaluationDraft(data: {
    competition: string;
    participant: string;
    panel: string;
    round: RoundIdentifier;
    scores: Array<{ parameter: string; awardedMarks: number }>;
  }): Promise<{ evaluation: Evaluation }> {
    return this.request<{ evaluation: Evaluation }>("/evaluations/draft", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async submitEvaluation(data: {
    competition: string;
    participant: string;
    panel: string;
    round: RoundIdentifier;
    scores: Array<{ parameter: string; awardedMarks: number }>;
  }): Promise<{ evaluation: Evaluation }> {
    return this.request<{ evaluation: Evaluation }>("/evaluations/submit", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getParticipantEvaluationDetails(
    participantId: string,
  ): Promise<{ details: ParticipantEvaluationDetails }> {
    return this.request<{ details: ParticipantEvaluationDetails }>(
      `/evaluations/participant/${participantId}`,
    );
  }

  // --- Judge Portal Endpoints ---
  async getJudgePanels(): Promise<{ panels: JudgeAssignedPanel[] }> {
    return this.request<{ panels: JudgeAssignedPanel[] }>("/judge/panels");
  }

  async getJudgePanelParticipants(panelId: string): Promise<{
    panel: { id: string; name: string; competitionId: string; competitionName: string };
    activeRound: RoundIdentifier | null;
    participants: Array<{
      id: string;
      name: string;
      registrationId: string;
      isEligible: boolean;
      evaluationStatus: "none" | "draft" | "submitted";
    }>;
  }> {
    return this.request(`/judge/panels/${panelId}/participants`);
  }

  async getJudgeEvaluations(): Promise<{ evaluations: Evaluation[] }> {
    return this.request<{ evaluations: Evaluation[] }>("/judge/evaluations");
  }

  // --- Leaderboard Endpoints ---
  async getOverallLeaderboard(competitionId: string): Promise<LeaderboardResult> {
    return this.request<LeaderboardResult>(`/competitions/${competitionId}/leaderboard`);
  }

  async getRoundLeaderboard(
    competitionId: string,
    round: RoundIdentifier,
  ): Promise<LeaderboardResult> {
    return this.request<LeaderboardResult>(
      `/competitions/${competitionId}/leaderboard/round/${round}`,
    );
  }

  async getPanelLeaderboard(
    competitionId: string,
    panelId: string,
  ): Promise<LeaderboardResult> {
    return this.request<LeaderboardResult>(
      `/competitions/${competitionId}/leaderboard/panel/${panelId}`,
    );
  }

  // --- Participant Portal Endpoints ---
  async getPublicCompetitions(): Promise<{ competitions: PublicCompetition[] }> {
    return this.request<{ competitions: PublicCompetition[] }>("/portal/competitions");
  }

  async registerParticipant(data: RegisterParticipantPayload): Promise<RegisterParticipantResponse> {
    const res = await this.request<RegisterParticipantResponse>("/auth/register-participant", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.token && res.user) {
      localStorage.setItem("karvaan_token", res.token);
      localStorage.setItem("karvaan_user", JSON.stringify(res.user));
    }
    return res;
  }

  async getParticipantProfile(): Promise<{ participant: ParticipantProfile }> {
    return this.request<{ participant: ParticipantProfile }>("/portal/profile");
  }

  async getParticipantResults(): Promise<ParticipantResults> {
    return this.request<ParticipantResults>("/portal/results");
  }

  async updateParticipantTeam(teamMembers: string[]): Promise<{ participant: ParticipantProfile }> {
    return this.request<{ participant: ParticipantProfile }>("/portal/team", {
      method: "PATCH",
      body: JSON.stringify({ teamMembers }),
    });
  }
}

export const api = new ApiService();
