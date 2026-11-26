import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { VentureCraftLogo } from "../../components/common/VentureCraftLogo";
import { api } from "../../services/api";
import type {
  LeaderboardResult,
  Panel,
  PublicCompetition,
  RankedLeaderboardEntry,
  RoundIdentifier,
} from "../../types/api";

export const LeaderboardPage: React.FC = () => {
  const { token } = useAuth();
  const [competitions, setCompetitions] = useState<PublicCompetition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");
  const [selectedRound, setSelectedRound] = useState<RoundIdentifier>(1);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanelFilter, setSelectedPanelFilter] = useState<string>("all");

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected participant for detail modal
  const [detailEntry, setDetailEntry] = useState<RankedLeaderboardEntry | null>(null);

  // 1. Initial load of competitions
  useEffect(() => {
    loadCompetitions();
  }, []);

  const loadCompetitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicCompetitions();

      if (!res || !Array.isArray(res.competitions)) {
        throw new Error("The competitions response was invalid. Please try again.");
      }

      const comps = res.competitions;
      setCompetitions(comps);

      // Prefer active competition, otherwise first one
      const active = comps.find((c) => c.status === "active") || comps[0];
      if (active) {
        setSelectedCompetitionId(active.id);
      } else {
        setSelectedCompetitionId("");
        setLeaderboardData(null);
        setPanels([]);
      }
    } catch (err: any) {
      setCompetitions([]);
      setSelectedCompetitionId("");
      setLeaderboardData(null);
      setPanels([]);
      setError(err?.message || "Failed to load competitions.");
    } finally {
      setLoading(false);
    }
  };

  // 2. When competition changes, load panels
  useEffect(() => {
    if (!selectedCompetitionId) return;
    if (!token) {
      setPanels([]);
      setSelectedPanelFilter("all");
      return;
    }
    loadPanels(selectedCompetitionId);
  }, [selectedCompetitionId, token]);

  const loadPanels = async (compId: string) => {
    try {
      const res = await api.getPanels(compId);

      if (!res || !Array.isArray(res.panels)) {
        throw new Error("The panels response was invalid.");
      }

      setPanels(res.panels);
      setSelectedPanelFilter("all");
    } catch (err) {
      console.error("Failed to load panels for competition:", err);
      setPanels([]);
      setSelectedPanelFilter("all");
    }
  };

  // 3. Load leaderboard data
  const fetchLeaderboard = async () => {
    if (!selectedCompetitionId) return;
    try {
      setError(null);
      let data: LeaderboardResult | null = null;
      if (selectedPanelFilter !== "all") {
        data = await api.getPanelLeaderboard(selectedCompetitionId, selectedPanelFilter);
      } else {
        data = await api.getRoundLeaderboard(selectedCompetitionId, selectedRound);
      }

      if (!data || !Array.isArray(data.leaderboard)) {
        throw new Error("The leaderboard response was invalid. Please try again.");
      }

      setLeaderboardData(data);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      setError(err?.message || "Failed to fetch leaderboard data.");
    }
  };

  // Refetch when competition, round, or panel changes
  useEffect(() => {
    if (!selectedCompetitionId) return;
    setLoading(true);
    fetchLeaderboard().finally(() => setLoading(false));
  }, [selectedCompetitionId, selectedRound, selectedPanelFilter]);

  const handlePrint = () => {
    window.print();
  };

  // Filter entries by search query
  const leaderboardEntries = Array.isArray(leaderboardData?.leaderboard)
    ? leaderboardData.leaderboard
    : [];
  const entries: RankedLeaderboardEntry[] = leaderboardEntries.filter(
    (e) =>
      e.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.registrationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.panelName && e.panelName.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const currentCompetition = competitions.find((c) => c.id === selectedCompetitionId);

  return (
    <div className="responsive-page-container">
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <VentureCraftLogo variant="emblem" height={44} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "28px", color: "var(--color-navy)", margin: 0 }}>
                Competition Leaderboard
              </h1>
          </div>
          <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
            Think • Adapt • Innovate
          </p>
        </div>
      </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            onClick={() => fetchLeaderboard()}
            className="btn btn-secondary"
            style={{ padding: "7px 14px", fontSize: "13px" }}
          >
            ↻ Refresh
          </button>

          <button
            onClick={handlePrint}
            className="btn btn-gold"
            style={{ padding: "7px 16px", fontSize: "13px" }}
          >
            🖨 Print / Export
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card no-print"
        style={{
          marginBottom: "24px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Round View Mode Tabs */}
          <div
            style={{
              display: "inline-flex",
              background: "var(--color-ivory-surface)",
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
            }}
          >
            <button
              onClick={() => setSelectedRound(1)}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                border: "none",
                background: selectedRound === 1 ? "var(--color-navy)" : "transparent",
                color: selectedRound === 1 ? "#FFFFFF" : "var(--color-navy)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Round 1
            </button>
            <button
              onClick={() => setSelectedRound(2)}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                border: "none",
                background: selectedRound === 2 ? "var(--color-navy)" : "transparent",
                color: selectedRound === 2 ? "#FFFFFF" : "var(--color-navy)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Round 2
            </button>
          </div>

          {/* Panel Filter */}
          {panels.length > 0 && (
            <select
              value={selectedPanelFilter}
              onChange={(e) => setSelectedPanelFilter(e.target.value)}
              style={{ minWidth: "160px", fontSize: "13px" }}
            >
              <option value="all">All Panels</option>
              {panels.map((p) => (
                <option key={p._id} value={p._id}>
                  Panel: {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Search Input */}
        <div style={{ width: "260px" }}>
          <input
            type="text"
            placeholder="Search participant or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: "13px", padding: "8px 12px" }}
          />
        </div>
      </div>

      {/* Print View Header Only */}
      <div className="only-print" style={{ display: "none", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <h1 style={{ fontSize: "22px", margin: 0 }}>{currentCompetition?.name} — Official Leaderboard</h1>
        </div>
        <p style={{ fontSize: "12px", color: "#666" }}>
          Scope: Round {selectedRound} | Generated:{" "}
          {lastRefreshedAt.toLocaleString()}
        </p>
      </div>

      {error && (
        <div
          className="card no-print"
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderColor: "rgba(142, 46, 46, 0.3)",
            background: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            fontSize: "14px",
          }}
        >
          <strong>Leaderboard unavailable.</strong> {error}
          <button
            type="button"
            onClick={() => (selectedCompetitionId ? fetchLeaderboard() : loadCompetitions())}
            className="btn btn-secondary"
            style={{ marginLeft: "12px", padding: "4px 10px", fontSize: "12px" }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && !leaderboardData ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "18px", color: "var(--color-navy)" }}>
            Calculating Rankings & Normalized Scores...
          </div>
        </div>
      ) : entries.length === 0 ? error ? null : (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <h3 style={{ fontSize: "18px", color: "var(--color-navy)", marginBottom: "8px" }}>
            No Leaderboard Records Available
          </h3>
          <p style={{ color: "var(--color-slate)", maxWidth: "500px", margin: "0 auto" }}>
            No submitted evaluations match the selected filter. Once judges submit final evaluations, ranks and scores will populate after a refresh.
          </p>
        </div>
      ) : (
        <>
          {/* Leaderboard Data Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "70px", textAlign: "center" }}>Rank</th>
                  <th style={{ width: "130px" }}>Reg. ID</th>
                  <th>Participant</th>
                  <th>Panel</th>
                  <th style={{ textAlign: "right" }}>Round Score</th>
                  <th style={{ textAlign: "right" }}>Raw Avg Marks</th>
                  <th style={{ textAlign: "center" }}>Judges Completed</th>
                  <th className="no-print" style={{ textAlign: "center", width: "100px" }}>
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  return (
                    <tr key={entry.participantId}>
                      {/* Rank Cell */}
                      <td style={{ textAlign: "center" }}>
                        {entry.rank === 1 ? (
                          <span
                            style={{
                              display: "inline-block",
                              width: "28px",
                              height: "28px",
                              lineHeight: "28px",
                              borderRadius: "50%",
                              background: "var(--color-gold)",
                              color: "#FFFFFF",
                              fontWeight: 800,
                            }}
                          >
                            1
                          </span>
                        ) : entry.rank === 2 ? (
                          <span
                            style={{
                              display: "inline-block",
                              width: "28px",
                              height: "28px",
                              lineHeight: "28px",
                              borderRadius: "50%",
                              background: "#9CA3AF",
                              color: "#FFFFFF",
                              fontWeight: 700,
                            }}
                          >
                            2
                          </span>
                        ) : entry.rank === 3 ? (
                          <span
                            style={{
                              display: "inline-block",
                              width: "28px",
                              height: "28px",
                              lineHeight: "28px",
                              borderRadius: "50%",
                              background: "#CD7F32",
                              color: "#FFFFFF",
                              fontWeight: 700,
                            }}
                          >
                            3
                          </span>
                        ) : (
                          <span style={{ fontWeight: 600, color: "var(--color-navy)" }}>
                            #{entry.rank}
                          </span>
                        )}
                      </td>

                      {/* Reg ID */}
                      <td style={{ fontFamily: "monospace", fontWeight: 600 }}>
                        {entry.registrationId}
                      </td>

                      {/* Participant Name */}
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--color-navy)" }}>
                          {entry.participantName}
                        </div>
                        {!entry.isEligible && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--color-danger)",
                              fontWeight: 600,
                            }}
                          >
                            Ineligible
                          </span>
                        )}
                      </td>

                      {/* Panel */}
                      <td style={{ color: "var(--color-slate)" }}>{entry.panelName || "—"}</td>

                      <td
                        style={{
                          textAlign: "right",
                          fontSize: "16px",
                          fontWeight: 800,
                          color: "var(--color-navy)",
                        }}
                      >
                        {entry.totalScore.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--color-slate)" }}>
                        {entry.rawTotalMarks.toFixed(1)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {(() => {
                          const rData = entry.roundResults?.[selectedRound];
                          if (!rData) return <span style={{ color: "var(--color-slate)" }}>0</span>;
                          return (
                            <span
                              className={`badge ${
                                rData.isComplete ? "badge-submitted" : "badge-pending"
                              }`}
                              style={{ fontSize: "11px" }}
                            >
                              {rData.judgeCount} / {rData.panelJudgeCount} Judges
                            </span>
                          );
                        })()}
                      </td>

                      {/* Details Button */}
                      <td className="no-print" style={{ textAlign: "center" }}>
                        <button
                          onClick={() => setDetailEntry(entry)}
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              color: "var(--color-slate)",
            }}
          >
            <div>Showing {entries.length} participant standing(s)</div>
            <div>Last synchronized: {lastRefreshedAt.toLocaleTimeString()}</div>
          </div>
        </>
      )}

      {/* Participant Score Breakdown Modal */}
      {detailEntry && (
        <div className="modal-backdrop" onClick={() => setDetailEntry(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "650px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div>
                <h3 style={{ fontSize: "20px", color: "var(--color-navy)", margin: 0 }}>
                  {detailEntry.participantName}
                </h3>
                <div style={{ fontSize: "13px", color: "var(--color-slate)", marginTop: "2px" }}>
                  Registration ID: <strong>{detailEntry.registrationId}</strong> | Panel:{" "}
                  <strong>{detailEntry.panelName || "N/A"}</strong>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase" }}>
                  Leaderboard Standing
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--color-navy)" }}>
                  Rank #{detailEntry.rank}
                </div>
              </div>
            </div>

            {/* Score Breakdown Per Round */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
              {[1, 2].map((rnd) => {
                const rData = detailEntry.roundResults?.[rnd as RoundIdentifier];
                if (!rData) {
                  return (
                    <div
                      key={rnd}
                      style={{
                        padding: "14px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-ivory-surface)",
                        border: "1px solid var(--color-border-subtle)",
                        color: "var(--color-slate)",
                        fontSize: "13px",
                      }}
                    >
                      Round {rnd}: Not evaluated / No submitted evaluations.
                    </div>
                  );
                }

                return (
                  <div
                    key={rnd}
                    style={{
                      padding: "16px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border)",
                      background: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <h4 style={{ fontSize: "15px", color: "var(--color-navy)", margin: 0 }}>
                        Round {rnd} Performance
                      </h4>
                      <span
                        className={`badge ${rData.isComplete ? "badge-submitted" : "badge-pending"}`}
                        style={{ fontSize: "11px" }}
                      >
                        {rData.judgeCount} of {rData.panelJudgeCount} Judges Scored
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "10px",
                        textAlign: "center",
                        background: "var(--color-ivory-surface)",
                        padding: "10px",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--color-slate)" }}>
                          Round Score
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-navy)" }}>
                          {rData.roundScore.toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "11px", color: "var(--color-slate)" }}>
                          Raw Avg Marks
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-navy)" }}>
                          {rData.rawAverageMarks.toFixed(1)} / {rData.maxPossibleMarks}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "11px", color: "var(--color-slate)" }}>
                          Completeness
                        </div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-gold)" }}>
                          {rData.isComplete ? "100%" : `${Math.round((rData.judgeCount / rData.panelJudgeCount) * 100)}%`}
                        </div>
                      </div>
                    </div>

                    {/* Judge Breakdown List */}
                    {rData.judgeScores && rData.judgeScores.length > 0 && (
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-slate)", marginBottom: "6px" }}>
                          Judge Evaluations Breakdown:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {rData.judgeScores.map((js, idx) => (
                            <div
                              key={js.judgeId || idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "12px",
                                padding: "6px 10px",
                                background: "var(--color-ivory-card)",
                                border: "1px solid var(--color-border-subtle)",
                                borderRadius: "4px",
                              }}
                            >
                              <span>Judge #{idx + 1}</span>
                              <span style={{ fontWeight: 600 }}>
                                Raw: {js.rawTotalMarks} pts | Normalized: {js.normalizedScore.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDetailEntry(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
