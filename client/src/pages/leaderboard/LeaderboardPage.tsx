import React, { useEffect, useRef, useState } from "react";
<<<<<<< Updated upstream
=======
import { useAuth } from "../../context/AuthContext";
>>>>>>> Stashed changes
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
  const [selectedRound, setSelectedRound] = useState<"overall" | RoundIdentifier>("overall");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanelFilter, setSelectedPanelFilter] = useState<string>("all");

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected participant for detail modal
  const [detailEntry, setDetailEntry] = useState<RankedLeaderboardEntry | null>(null);

  const refreshTimerRef = useRef<any>(null);

  // 1. Initial load of competitions
  useEffect(() => {
    loadCompetitions();
  }, []);

  const loadCompetitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicCompetitions();
      const comps = res.competitions || [];
      setCompetitions(comps);

      // Prefer active competition, otherwise first one
      const active = comps.find((c) => c.status === "active") || comps[0];
      if (active) {
        setSelectedCompetitionId(active.id);
      }
    } catch (err: any) {
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
      setPanels(res.panels || []);
      setSelectedPanelFilter("all");
    } catch (err) {
      console.error("Failed to load panels for competition:", err);
    }
  };

  // 3. Load leaderboard data
  const fetchLeaderboard = async () => {
    if (!selectedCompetitionId) return;
    try {
      setError(null);
      let data: LeaderboardResult;
      if (selectedPanelFilter !== "all") {
        data = await api.getPanelLeaderboard(selectedCompetitionId, selectedPanelFilter);
      } else if (selectedRound === "overall") {
        data = await api.getOverallLeaderboard(selectedCompetitionId);
      } else {
        data = await api.getRoundLeaderboard(selectedCompetitionId, selectedRound);
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

  // 4. Auto-refresh polling every 15 seconds
  useEffect(() => {
    if (!autoRefresh || !selectedCompetitionId) return;

    refreshTimerRef.current = setInterval(() => {
      fetchLeaderboard();
    }, 15000);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh, selectedCompetitionId, selectedRound, selectedPanelFilter]);

  const handlePrint = () => {
    window.print();
  };

  // Filter entries by search query
  const entries: RankedLeaderboardEntry[] = (leaderboardData?.leaderboard || []).filter(
    (e) =>
      e.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.registrationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.panelName && e.panelName.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const top3 = entries.slice(0, 3);
  const currentCompetition = competitions.find((c) => c.id === selectedCompetitionId);

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Page Title & Live Pulse Header */}
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
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h1 style={{ fontSize: "28px", color: "var(--color-navy)", margin: 0 }}>
                Live Competition Leaderboard
              </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(47, 111, 78, 0.12)",
                color: "var(--color-success)",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--color-success)",
                  boxShadow: "0 0 6px var(--color-success)",
                  animation: "pulse 2s infinite",
                }}
              />
              LIVE
            </span>
          </div>
          <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
            Real-time standardized scores, multi-judge aggregation, and deterministic standings.
          </p>
        </div>
      </div>

        {/* Live Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              cursor: "pointer",
              color: "var(--color-charcoal)",
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ width: "auto" }}
            />
            Auto-refresh (15s)
          </label>

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
        {/* Left: Competition Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <select
              value={selectedCompetitionId}
              onChange={(e) => setSelectedCompetitionId(e.target.value)}
              style={{ minWidth: "220px", fontWeight: 600 }}
            >
              {competitions.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name} ({comp.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

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
              onClick={() => {
                setSelectedRound("overall");
                setSelectedPanelFilter("all");
              }}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                border: "none",
                background:
                  selectedRound === "overall" && selectedPanelFilter === "all"
                    ? "var(--color-navy)"
                    : "transparent",
                color:
                  selectedRound === "overall" && selectedPanelFilter === "all"
                    ? "#FFFFFF"
                    : "var(--color-navy)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Overall Standing
            </button>
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
          Scope: {selectedRound === "overall" ? "Overall Aggregate" : `Round ${selectedRound}`} | Generated:{" "}
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
            No submitted evaluations match the selected filter. Once judges submit final evaluations, ranks and scores will populate live.
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Showcase (Only in Overall or All Panels view) */}
          {selectedPanelFilter === "all" && top3.length >= 2 && !searchQuery && (
            <div
              className="no-print"
              style={{
                display: "grid",
                gridTemplateColumns: top3.length >= 3 ? "1fr 1.15fr 1fr" : "1fr 1fr",
                gap: "20px",
                alignItems: "end",
                marginBottom: "32px",
                marginTop: "12px",
              }}
            >
              {/* 2nd Place */}
              {top3[1] && (
                <div
                  className="card"
                  style={{
                    textAlign: "center",
                    padding: "24px 16px",
                    background: "linear-gradient(180deg, #FFFFFF 0%, #FAF7F0 100%)",
                    border: "2px solid #D1D5DB",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: "#9CA3AF",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "-42px auto 12px",
                      fontWeight: 700,
                      fontSize: "18px",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    2
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase" }}>
                    Silver Podium
                  </div>
                  <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-navy)", marginTop: "4px" }}>
                    {top3[1].participantName}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-slate)", fontFamily: "monospace" }}>
                    {top3[1].registrationId}
                  </div>
                  <div style={{ marginTop: "12px", fontSize: "24px", fontWeight: 800, color: "var(--color-navy)" }}>
                    {top3[1].totalScore.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-slate)" }}>
                    Avg: {top3[1].rawTotalMarks.toFixed(1)} pts
                  </div>
                </div>
              )}

              {/* 1st Place (Champion) */}
              {top3[0] && (
                <div
                  className="card"
                  style={{
                    textAlign: "center",
                    padding: "32px 20px",
                    background: "linear-gradient(180deg, #FFFDF9 0%, #F5EEDB 100%)",
                    border: "2px solid var(--color-gold)",
                    boxShadow: "var(--shadow-lg)",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "var(--color-gold)",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "-58px auto 14px",
                      fontWeight: 800,
                      fontSize: "24px",
                      boxShadow: "0 4px 14px rgba(181, 154, 101, 0.4)",
                    }}
                  >
                    👑 1
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Leader / Champion
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-navy)", marginTop: "4px" }}>
                    {top3[0].participantName}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--color-slate)", fontFamily: "monospace" }}>
                    {top3[0].registrationId}
                  </div>
                  <div style={{ marginTop: "14px", fontSize: "32px", fontWeight: 900, color: "var(--color-navy)" }}>
                    {top3[0].totalScore.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-gold)", fontWeight: 600 }}>
                    Avg: {top3[0].rawTotalMarks.toFixed(1)} raw marks
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <div
                  className="card"
                  style={{
                    textAlign: "center",
                    padding: "24px 16px",
                    background: "linear-gradient(180deg, #FFFFFF 0%, #FAF7F0 100%)",
                    border: "2px solid #E5BA82",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: "#CD7F32",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "-42px auto 12px",
                      fontWeight: 700,
                      fontSize: "18px",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    3
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase" }}>
                    Bronze Podium
                  </div>
                  <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-navy)", marginTop: "4px" }}>
                    {top3[2].participantName}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-slate)", fontFamily: "monospace" }}>
                    {top3[2].registrationId}
                  </div>
                  <div style={{ marginTop: "12px", fontSize: "24px", fontWeight: 800, color: "var(--color-navy)" }}>
                    {top3[2].totalScore.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-slate)" }}>
                    Avg: {top3[2].rawTotalMarks.toFixed(1)} pts
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Data Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "70px", textAlign: "center" }}>Rank</th>
                  <th style={{ width: "130px" }}>Reg. ID</th>
                  <th>Participant</th>
                  <th>Panel</th>
                  {selectedRound === "overall" ? (
                    <>
                      <th style={{ textAlign: "right" }}>Round 1 Score</th>
                      <th style={{ textAlign: "right" }}>Round 2 Score</th>
                      <th style={{ textAlign: "right" }}>Normalized Score</th>
                      <th style={{ textAlign: "right" }}>Raw Average</th>
                    </>
                  ) : (
                    <>
                      <th style={{ textAlign: "right" }}>Round Score</th>
                      <th style={{ textAlign: "right" }}>Raw Avg Marks</th>
                      <th style={{ textAlign: "center" }}>Judges Completed</th>
                    </>
                  )}
                  <th className="no-print" style={{ textAlign: "center", width: "100px" }}>
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const r1 = entry.roundResults?.[1];
                  const r2 = entry.roundResults?.[2];

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

                      {/* Conditional Round Columns */}
                      {selectedRound === "overall" ? (
                        <>
                          <td style={{ textAlign: "right" }}>
                            {r1 ? (
                              <span style={{ fontWeight: 600 }}>{r1.roundScore.toFixed(2)}</span>
                            ) : (
                              <span style={{ color: "var(--color-slate)" }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {r2 ? (
                              <span style={{ fontWeight: 600 }}>{r2.roundScore.toFixed(2)}</span>
                            ) : (
                              <span style={{ color: "var(--color-slate)" }}>—</span>
                            )}
                          </td>
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
                        </>
                      ) : (
                        <>
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
                              const rData = entry.roundResults?.[selectedRound as RoundIdentifier];
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
                        </>
                      )}

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
                  Overall Standing
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
