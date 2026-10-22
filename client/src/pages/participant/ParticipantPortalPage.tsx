import React, { useEffect, useState } from "react";
import { KARVAANLogo } from "../../components/common/KARVAANLogo";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import type {
  ParticipantProfile,
  ParticipantResults,
} from "../../types/api";

export const ParticipantPortalPage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [results, setResults] = useState<ParticipantResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"scores" | "profile" | "scorecard">("scores");

  // Team editing state
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editableMembers, setEditableMembers] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamSuccessMessage, setTeamSuccessMessage] = useState<string | null>(null);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setResultsError(null);

    try {
      const [profileRes, resultsRes] = await Promise.all([
        api.getParticipantProfile(),
        api.getParticipantResults().catch((err) => {
          setResultsError(err.message || "Failed to load evaluation results.");
          return null;
        }),
      ]);

      setProfile(profileRes.participant);
      setEditableMembers(profileRes.participant.teamMembers || []);
      setResults(resultsRes);
    } catch (err: any) {
      setError(err.message || "Failed to load participant data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMember = () => {
    const trimmed = newMemberName.trim();
    if (trimmed && !editableMembers.includes(trimmed)) {
      setEditableMembers([...editableMembers, trimmed]);
      setNewMemberName("");
    }
  };

  const handleRemoveMember = (idx: number) => {
    setEditableMembers(editableMembers.filter((_, i) => i !== idx));
  };

  const handleSaveTeam = async () => {
    setSavingTeam(true);
    setTeamSuccessMessage(null);
    setError(null);
    try {
      const finalMembers = [...editableMembers];
      if (newMemberName.trim() && !finalMembers.includes(newMemberName.trim())) {
        finalMembers.push(newMemberName.trim());
        setNewMemberName("");
      }

      const res = await api.updateParticipantTeam(finalMembers);
      setProfile(res.participant);
      setEditableMembers(res.participant.teamMembers || []);
      setIsEditingTeam(false);
      setTeamSuccessMessage("Team members updated successfully.");
      setTimeout(() => setTeamSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update team members.");
    } finally {
      setSavingTeam(false);
    }
  };

  const handlePrint = () => {
    setActiveTab("scorecard");
    setTimeout(() => {
      window.print();
    }, 200);
  };

  if (loading) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--color-slate)" }}>
        <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-navy)", marginBottom: "8px" }}>
          Loading Participant Portal...
        </div>
        <p style={{ fontSize: "14px" }}>Fetching your registration status, evaluations, and schedule.</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div style={{ padding: "48px 24px", maxWidth: "600px", margin: "0 auto" }}>
        <div className="card" style={{ borderColor: "rgba(142, 46, 46, 0.3)", background: "#FFFFFF" }}>
          <h3 style={{ color: "var(--color-maroon)", marginBottom: "12px" }}>Notice</h3>
          <p style={{ fontSize: "14px", color: "var(--color-charcoal)", marginBottom: "20px" }}>
            {error}
          </p>
          <button onClick={() => loadData()} className="btn btn-primary">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const round2Eligibility = profile?.eligibility?.find((e) => e.round === 2);

  return (
    <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "28px 20px 60px" }}>
      {/* Top Banner / Hero */}
      <div
        className="no-print card"
        style={{
          background: "linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-dark) 100%)",
          color: "#FFFFFF",
          padding: "28px 32px",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(181, 154, 101, 0.4)",
          boxShadow: "var(--shadow-md)",
          marginBottom: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-20px",
            top: "-20px",
            opacity: 0.08,
            pointerEvents: "none",
          }}
        >
          <KARVAANLogo size="lg" variant="light" showText={false} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span
                style={{
                  background: "rgba(181, 154, 101, 0.2)",
                  color: "var(--color-gold)",
                  border: "1px solid rgba(181, 154, 101, 0.4)",
                  padding: "2px 10px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Participant Portal
              </span>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#FFFFFF",
                  padding: "2px 10px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                ID: {profile?.registrationId}
              </span>
            </div>

            <h1
              style={{
                color: "#FFFFFF",
                fontSize: "26px",
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              {profile?.name}
            </h1>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", fontSize: "13px", color: "rgba(255, 255, 255, 0.8)" }}>
              <div>
                <strong>Event:</strong> {profile?.competition?.name || "Competition"}
              </div>
              <div>•</div>
              <div>
                <strong>Email:</strong> {profile?.email}
              </div>
              <div>•</div>
              <div>
                <strong>Panel:</strong>{" "}
                {profile?.panel ? (
                  <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>
                    {profile.panel.name} {profile.panel.room ? `(${profile.panel.room})` : ""}
                  </span>
                ) : (
                  <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Pending Assignment</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="btn btn-secondary"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                borderColor: "rgba(255, 255, 255, 0.25)",
                color: "#FFFFFF",
                padding: "8px 14px",
                fontSize: "13px",
              }}
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>
            <button
              onClick={handlePrint}
              className="btn btn-gold"
              style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600 }}
            >
              🖨 Print Scorecard
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        className="no-print"
        style={{
          display: "flex",
          borderBottom: "2px solid var(--color-border)",
          marginBottom: "24px",
          gap: "8px",
        }}
      >
        <button
          onClick={() => setActiveTab("scores")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "scores" ? "3px solid var(--color-gold)" : "3px solid transparent",
            color: activeTab === "scores" ? "var(--color-navy)" : "var(--color-slate)",
            fontWeight: activeTab === "scores" ? 700 : 500,
            fontSize: "15px",
            marginBottom: "-2px",
            cursor: "pointer",
          }}
        >
          Performance & Scores
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "profile" ? "3px solid var(--color-gold)" : "3px solid transparent",
            color: activeTab === "profile" ? "var(--color-navy)" : "var(--color-slate)",
            fontWeight: activeTab === "profile" ? 700 : 500,
            fontSize: "15px",
            marginBottom: "-2px",
            cursor: "pointer",
          }}
        >
          Team & Registration Info
        </button>

        <button
          onClick={() => setActiveTab("scorecard")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "scorecard" ? "3px solid var(--color-gold)" : "3px solid transparent",
            color: activeTab === "scorecard" ? "var(--color-navy)" : "var(--color-slate)",
            fontWeight: activeTab === "scorecard" ? 700 : 500,
            fontSize: "15px",
            marginBottom: "-2px",
            cursor: "pointer",
          }}
        >
          Official Certificate View
        </button>
      </div>

      {/* Global Alerts / Messages */}
      {error && (
        <div
          className="no-print"
          style={{
            padding: "12px 16px",
            background: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            border: "1px solid rgba(142, 46, 46, 0.25)",
            borderRadius: "var(--radius-sm)",
            fontSize: "14px",
            marginBottom: "20px",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {teamSuccessMessage && (
        <div
          className="no-print"
          style={{
            padding: "12px 16px",
            background: "var(--color-success-bg)",
            color: "var(--color-success)",
            border: "1px solid rgba(47, 111, 78, 0.25)",
            borderRadius: "var(--radius-sm)",
            fontSize: "14px",
            marginBottom: "20px",
            fontWeight: 500,
          }}
        >
          ✓ {teamSuccessMessage}
        </div>
      )}

      {/* TAB 1: SCORES & PERFORMANCE */}
      {activeTab === "scores" && (
        <div>
          {resultsError && (
            <div
              className="card"
              style={{
                padding: "16px 20px",
                marginBottom: "20px",
                borderColor: "rgba(142, 46, 46, 0.3)",
                background: "var(--color-danger-bg)",
                color: "var(--color-danger)",
                fontSize: "14px",
              }}
            >
              <strong>Results could not be loaded.</strong> {resultsError}
              <button
                type="button"
                onClick={() => loadData(true)}
                className="btn btn-secondary"
                style={{ marginLeft: "12px", padding: "4px 10px", fontSize: "12px" }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--color-slate)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Total Normalized Score
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
                <span style={{ fontSize: "32px", fontWeight: 700, color: "var(--color-navy)" }}>
                  {results ? results.overallScore.toFixed(2) : "—"}
                </span>
                <span style={{ fontSize: "14px", color: "var(--color-slate)" }}>
                  / {results?.maxPossibleScore ?? 100}
                </span>
              </div>
              <div style={{ marginTop: "10px", height: "6px", background: "var(--color-ivory-surface)", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: "var(--color-gold)",
                    width: results ? `${Math.min(100, (results.overallScore / (results.maxPossibleScore || 100)) * 100)}%` : "0%",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </div>

            <div className="card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--color-slate)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Raw Evaluated Marks
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
                <span style={{ fontSize: "32px", fontWeight: 700, color: "var(--color-navy)" }}>
                  {results ? results.rawTotalMarks.toFixed(1) : "—"}
                </span>
                <span style={{ fontSize: "14px", color: "var(--color-slate)" }}>total points</span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-slate)", marginTop: "10px" }}>
                Cumulative across participating rounds
              </div>
            </div>

            <div className="card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--color-slate)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Overall Status
              </div>
              <div style={{ marginTop: "8px" }}>
                {results?.evaluationStatus === "completed" ? (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 14px",
                      background: "var(--color-success-bg)",
                      color: "var(--color-success)",
                      borderRadius: "16px",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Evaluations Completed
                  </span>
                ) : results?.evaluationStatus === "in_progress" ? (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 14px",
                      background: "rgba(181, 154, 101, 0.2)",
                      color: "var(--color-gold-hover)",
                      borderRadius: "16px",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Evaluation In Progress
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 14px",
                      background: "var(--color-ivory-surface)",
                      color: "var(--color-slate)",
                      borderRadius: "16px",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Awaiting Evaluation
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-slate)", marginTop: "10px" }}>
                {profile?.panel ? `Evaluated under ${profile.panel.name}` : "Awaiting panel assignment"}
              </div>
            </div>

            <div className="card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--color-slate)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Round 2 Qualification
              </div>
              <div style={{ marginTop: "8px" }}>
                {round2Eligibility ? (
                  round2Eligibility.eligible ? (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 14px",
                        background: "var(--color-success-bg)",
                        color: "var(--color-success)",
                        borderRadius: "16px",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      ★ Qualified for Round 2
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 14px",
                        background: "var(--color-danger-bg)",
                        color: "var(--color-danger)",
                        borderRadius: "16px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      Not Qualified ({round2Eligibility.ineligibleReason || "Cutoff not met"})
                    </span>
                  )
                ) : (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 14px",
                      background: "var(--color-ivory-surface)",
                      color: "var(--color-slate)",
                      borderRadius: "16px",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    Round 1 Pending / Deciding
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-slate)", marginTop: "10px" }}>
                Based on admin qualification cutoff
              </div>
            </div>
          </div>

          {/* Rounds Breakdown */}
          {results && results.rounds.length > 0 ? (
            results.rounds.map((roundDetail) => (
              <div
                key={roundDetail.round}
                className="card"
                style={{
                  marginBottom: "24px",
                  padding: "24px 28px",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    paddingBottom: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "18px", color: "var(--color-navy)", marginBottom: "4px" }}>
                      Round {roundDetail.round} Evaluation
                    </h3>
                    <div style={{ fontSize: "13px", color: "var(--color-slate)" }}>
                      Judges Evaluated:{" "}
                      <strong>
                        {roundDetail.judgeCount} / {roundDetail.panelJudgeCount || roundDetail.judgeCount}
                      </strong>{" "}
                      panel judges completed
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background:
                          roundDetail.status === "evaluated"
                            ? "var(--color-success-bg)"
                            : roundDetail.status === "in_progress"
                            ? "var(--color-warning-bg)"
                            : "var(--color-ivory-surface)",
                        color:
                          roundDetail.status === "evaluated"
                            ? "var(--color-success)"
                            : roundDetail.status === "in_progress"
                            ? "var(--color-warning)"
                            : "var(--color-slate)",
                      }}
                    >
                      {roundDetail.status === "evaluated"
                        ? "Evaluated"
                        : roundDetail.status === "in_progress"
                        ? "Partial Evaluation"
                        : "Pending Evaluation"}
                    </span>

                    <div
                      style={{
                        padding: "6px 14px",
                        background: "var(--color-ivory-surface)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                        textAlign: "right",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "var(--color-slate)", display: "block" }}>
                        Round Score
                      </span>
                      <strong style={{ fontSize: "18px", color: "var(--color-navy)" }}>
                        {roundDetail.roundScore.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Criteria Table */}
                {roundDetail.criteriaScores && roundDetail.criteriaScores.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                          <th style={{ padding: "10px 12px", color: "var(--color-navy)", fontWeight: 600 }}>
                            Evaluation Criterion
                          </th>
                          <th style={{ padding: "10px 12px", color: "var(--color-navy)", fontWeight: 600, textAlign: "center" }}>
                            Weightage
                          </th>
                          <th style={{ padding: "10px 12px", color: "var(--color-navy)", fontWeight: 600, textAlign: "right" }}>
                            Avg Awarded
                          </th>
                          <th style={{ padding: "10px 12px", color: "var(--color-navy)", fontWeight: 600, textAlign: "right" }}>
                            Max Marks
                          </th>
                          <th style={{ padding: "10px 12px", color: "var(--color-navy)", fontWeight: 600, width: "180px" }}>
                            Performance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundDetail.criteriaScores.map((crit) => (
                          <tr
                            key={crit.parameterId}
                            style={{
                              borderBottom: "1px solid var(--color-border-subtle)",
                              transition: "background 0.15s",
                            }}
                          >
                            <td style={{ padding: "12px", fontWeight: 600, color: "var(--color-charcoal)" }}>
                              {crit.parameterName}
                            </td>
                            <td style={{ padding: "12px", textAlign: "center", color: "var(--color-slate)" }}>
                              {crit.weightage}%
                            </td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "var(--color-navy)" }}>
                              {crit.awardedMarks.toFixed(1)}
                            </td>
                            <td style={{ padding: "12px", textAlign: "right", color: "var(--color-slate)" }}>
                              {crit.maxMarks}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div
                                  style={{
                                    flex: 1,
                                    height: "6px",
                                    background: "var(--color-ivory-surface)",
                                    borderRadius: "3px",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      background:
                                        crit.percentage >= 75
                                          ? "var(--color-success)"
                                          : crit.percentage >= 50
                                          ? "var(--color-gold)"
                                          : "var(--color-slate)",
                                      width: `${Math.min(100, Math.max(0, crit.percentage))}%`,
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: "12px", fontWeight: 600, minWidth: "38px", textAlign: "right" }}>
                                  {crit.percentage.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--color-slate)", fontSize: "14px" }}>
                    No individual criteria evaluated for this round yet.
                  </div>
                )}
              </div>
            ))
          ) : (
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "var(--color-slate)",
              }}
            >
              <h3 style={{ color: "var(--color-navy)", marginBottom: "8px" }}>No Evaluation Scores Released Yet</h3>
              <p style={{ maxWidth: "500px", margin: "0 auto", fontSize: "14px" }}>
                Your jury panel has not yet finalized submissions for your presentation. Once evaluations are locked and published, your marks breakdown will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROFILE & TEAM */}
      {activeTab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          {/* Registration Information Card */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "18px", color: "var(--color-navy)", marginBottom: "16px", borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: "10px" }}>
              Registration Details
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase", display: "block", fontWeight: 600 }}>
                  Participant / Team Name
                </label>
                <div style={{ fontWeight: 600, color: "var(--color-navy)", fontSize: "16px" }}>
                  {profile?.name}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase", display: "block", fontWeight: 600 }}>
                  Registration ID / Roll
                </label>
                <div style={{ fontWeight: 600, color: "var(--color-charcoal)" }}>
                  {profile?.registrationId}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase", display: "block", fontWeight: 600 }}>
                  Official Email
                </label>
                <div style={{ color: "var(--color-charcoal)" }}>{profile?.email}</div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase", display: "block", fontWeight: 600 }}>
                  Enrolled Competition
                </label>
                <div style={{ fontWeight: 600, color: "var(--color-navy)" }}>
                  {profile?.competition.name}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-slate)", marginTop: "2px" }}>
                  Status: {profile?.competition.status.toUpperCase()}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase", display: "block", fontWeight: 600 }}>
                  Assigned Panel & Room
                </label>
                {profile?.panel ? (
                  <div style={{ fontWeight: 600, color: "var(--color-navy)" }}>
                    {profile.panel.name} {profile.panel.room ? `• Room: ${profile.panel.room}` : "• Room TBD"}
                  </div>
                ) : (
                  <div style={{ color: "var(--color-slate)", fontStyle: "italic" }}>
                    Unassigned (Admin will assign panel before judging begins)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Team Members Management Card */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: "10px" }}>
              <h3 style={{ fontSize: "18px", color: "var(--color-navy)" }}>Team Members</h3>
              {!isEditingTeam ? (
                <button
                  type="button"
                  onClick={() => setIsEditingTeam(true)}
                  className="btn btn-secondary"
                  style={{ padding: "4px 12px", fontSize: "12px" }}
                >
                  ✎ Edit Team
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTeam(false);
                    setEditableMembers(profile?.teamMembers || []);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: "4px 12px", fontSize: "12px" }}
                >
                  Cancel
                </button>
              )}
            </div>

            {!isEditingTeam ? (
              <div>
                {profile?.teamMembers && profile.teamMembers.length > 0 ? (
                  <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {profile.teamMembers.map((member, i) => (
                      <li
                        key={i}
                        style={{
                          padding: "8px 12px",
                          background: "var(--color-ivory-surface)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border)",
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "var(--color-navy)",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span style={{ color: "var(--color-gold)", fontWeight: 700 }}>•</span>
                        {member}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: "var(--color-slate)", fontSize: "14px", fontStyle: "italic" }}>
                    No team members listed (Individual entry). Click "Edit Team" to register teammates.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "13px", color: "var(--color-slate)", marginBottom: "12px" }}>
                  Add or remove the names of all registered members on your team:
                </p>

                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMember();
                      }
                    }}
                    placeholder="Team member full name"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="btn btn-secondary"
                    style={{ padding: "0 14px", fontSize: "13px" }}
                  >
                    Add
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                  {editableMembers.map((member, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "var(--color-cream)",
                        border: "1px solid var(--color-border)",
                        padding: "4px 10px",
                        borderRadius: "16px",
                        fontSize: "13px",
                        color: "var(--color-navy)",
                      }}
                    >
                      {member}
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--color-maroon)",
                          fontSize: "15px",
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSaveTeam}
                  disabled={savingTeam}
                  className="btn btn-gold"
                  style={{ width: "100%", padding: "10px", fontWeight: 600 }}
                >
                  {savingTeam ? "Saving Changes..." : "Save Team Members"}
                </button>
              </div>
            )}

            {/* Eligibility Breakdown */}
            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--color-border-subtle)" }}>
              <label style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase", display: "block", fontWeight: 600, marginBottom: "8px" }}>
                Competition Eligibility Status
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span>Round 1 (Preliminary):</span>
                  <strong style={{ color: "var(--color-success)" }}>Eligible</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span>Round 2 (Finals):</span>
                  {round2Eligibility ? (
                    round2Eligibility.eligible ? (
                      <strong style={{ color: "var(--color-success)" }}>Qualified</strong>
                    ) : (
                      <strong style={{ color: "var(--color-maroon)" }}>
                        Not Qualified ({round2Eligibility.ineligibleReason || "Cutoff"})
                      </strong>
                    )
                  ) : (
                    <span style={{ color: "var(--color-slate)" }}>Pending Preliminary Results</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OFFICIAL SCORECARD (PRINTABLE CERTIFICATE) */}
      {activeTab === "scorecard" && (
        <div
          className="printable-scorecard"
          style={{
            background: "#FFFFFF",
            border: "2px solid var(--color-gold)",
            borderRadius: "var(--radius-sm)",
            padding: "48px 40px",
            boxShadow: "var(--shadow-lg)",
            color: "var(--color-navy)",
            maxWidth: "860px",
            margin: "0 auto",
          }}
        >
          {/* Printable Header */}
          <div style={{ textAlign: "center", borderBottom: "2px solid var(--color-navy)", paddingBottom: "24px", marginBottom: "28px" }}>
            <KARVAANLogo size="md" variant="dark" showTagline={true} className="logo-centered" />
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "24px",
                letterSpacing: "0.05em",
                marginTop: "16px",
                marginBottom: "4px",
              }}
            >
              OFFICIAL EVALUATION SCORECARD
            </h2>
            <div style={{ fontSize: "14px", color: "var(--color-slate)", fontStyle: "italic" }}>
              {profile?.competition?.name || "Competition Series"}
            </div>
          </div>

          {/* Participant & Panel Info Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              background: "var(--color-ivory-surface)",
              padding: "18px 20px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              marginBottom: "28px",
              fontSize: "13px",
            }}
          >
            <div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Participant / Team:</strong> {profile?.name}
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Registration ID:</strong> {profile?.registrationId}
              </div>
              <div>
                <strong>Email:</strong> {profile?.email}
              </div>
            </div>

            <div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Jury Panel:</strong> {profile?.panel?.name || "Unassigned"}
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Presentation Room:</strong> {profile?.panel?.room || "Main Auditorium"}
              </div>
              <div>
                <strong>Date Generated:</strong> {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          </div>

          {/* Score Summary Banner */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--color-navy)",
              color: "#FFFFFF",
              padding: "16px 24px",
              borderRadius: "var(--radius-sm)",
              marginBottom: "28px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-gold)" }}>
                Cumulative Standing Score
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700 }}>
                {results ? results.overallScore.toFixed(2) : "0.00"}{" "}
                <span style={{ fontSize: "15px", fontWeight: 400, color: "rgba(255, 255, 255, 0.7)" }}>
                  / {results?.maxPossibleScore ?? 100}
                </span>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "12px", color: "var(--color-gold)" }}>
                Raw Points: {results ? results.rawTotalMarks.toFixed(1) : "0.0"}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>
                Status: {results?.evaluationStatus ? results.evaluationStatus.toUpperCase() : "PENDING"}
              </div>
            </div>
          </div>

          {/* Comprehensive Results Breakdown */}
          {results && results.rounds.map((round) => (
            <div key={round.round} style={{ marginBottom: "28px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "1px solid var(--color-navy)",
                  paddingBottom: "8px",
                  marginBottom: "12px",
                }}
              >
                <h4 style={{ fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Round {round.round} Assessment
                </h4>
                <div style={{ fontWeight: 700 }}>
                  Score: {round.roundScore.toFixed(2)} pts ({round.judgeCount} judge evaluations)
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--color-navy)", color: "#FFFFFF" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Parameter</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Weight</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Avg Awarded</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Max Marks</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Attainment</th>
                  </tr>
                </thead>
                <tbody>
                  {round.criteriaScores.map((c, i) => (
                    <tr
                      key={c.parameterId}
                      style={{
                        background: i % 2 === 0 ? "#FFFFFF" : "var(--color-ivory-surface)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{c.parameterName}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>{c.weightage}%</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>
                        {c.awardedMarks.toFixed(1)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{c.maxMarks}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                        {c.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Footer Seals & Verification */}
          <div
            style={{
              marginTop: "48px",
              paddingTop: "24px",
              borderTop: "1px dashed var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div style={{ textAlign: "center", width: "200px" }}>
              <div style={{ height: "40px", borderBottom: "1px solid var(--color-navy)", marginBottom: "6px" }} />
              <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>
                Jury / Panel Chair
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: "11px", color: "var(--color-slate)" }}>
              <div style={{ fontWeight: 700, color: "var(--color-navy)", letterSpacing: "0.06em", marginBottom: "2px" }}>
                KARVAAN EVALUATION SYSTEM
              </div>
              <div>Certified Digital Verification</div>
            </div>

            <div style={{ textAlign: "center", width: "200px" }}>
              <div style={{ height: "40px", borderBottom: "1px solid var(--color-navy)", marginBottom: "6px" }} />
              <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>
                Organizing Secretary
              </div>
            </div>
          </div>

          {/* Print Trigger Button */}
          <div className="no-print" style={{ textAlign: "center", marginTop: "32px" }}>
            <button onClick={() => window.print()} className="btn btn-gold" style={{ padding: "10px 24px", fontSize: "14px", fontWeight: 600 }}>
              🖨 Send to Printer or Save as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
