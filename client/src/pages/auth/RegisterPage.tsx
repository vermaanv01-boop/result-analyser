import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KARVAANLogo } from "../../components/common/KARVAANLogo";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import type { PublicCompetition } from "../../types/api";

export const RegisterPage: React.FC = () => {
  const [competitions, setCompetitions] = useState<PublicCompetition[]>([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(true);

  const [competitionId, setCompetitionId] = useState("");
  const [name, setName] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [teamMembersInput, setTeamMembersInput] = useState("");
  const [teamMembers, setTeamMembers] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { registerParticipant } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchCompetitions = async () => {
      try {
        const res = await api.getPublicCompetitions();
        if (mounted) {
          setCompetitions(res.competitions);
          if (res.competitions.length > 0) {
            setCompetitionId(res.competitions[0].id);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to load active competitions");
        }
      } finally {
        if (mounted) {
          setLoadingCompetitions(false);
        }
      }
    };

    fetchCompetitions();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddMember = () => {
    const trimmed = teamMembersInput.trim();
    if (trimmed && !teamMembers.includes(trimmed)) {
      setTeamMembers([...teamMembers, trimmed]);
      setTeamMembersInput("");
    }
  };

  const handleRemoveMember = (idx: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== idx));
  };

  const handleKeyDownMember = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddMember();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!competitionId) {
      setError("Please select a competition to register for.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Include any trailing input in member list
    const finalMembers = [...teamMembers];
    if (teamMembersInput.trim() && !finalMembers.includes(teamMembersInput.trim())) {
      finalMembers.push(teamMembersInput.trim());
    }

    setSubmitting(true);
    try {
      await registerParticipant({
        competitionId,
        name: name.trim(),
        registrationId: registrationId.trim(),
        email: email.trim(),
        password,
        teamMembers: finalMembers,
      });

      navigate("/participant", { replace: true });
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 68px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "36px 16px",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "540px",
          padding: "36px 32px",
          background: "#FFFFFF",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <KARVAANLogo
            size="md"
            showText={true}
            showTagline={false}
            variant="dark"
            className="logo-centered"
          />
        </div>

        <div
          style={{
            height: "1px",
            background: "var(--color-border)",
            margin: "0 auto 24px",
            width: "80%",
          }}
        />

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2
            style={{
              fontSize: "20px",
              marginBottom: "6px",
              color: "var(--color-navy)",
            }}
          >
            Participant Registration
          </h2>
          <p style={{ color: "var(--color-slate)", fontSize: "13px" }}>
            Create your account to view your evaluation scores, room assignments, and standing
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 14px",
              background: "var(--color-danger-bg)",
              color: "var(--color-danger)",
              border: "1px solid rgba(142, 46, 46, 0.2)",
              borderRadius: "4px",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {loadingCompetitions ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--color-slate)" }}>
            Loading active competitions...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--color-navy)",
                  marginBottom: "6px",
                }}
              >
                Select Competition <span style={{ color: "var(--color-maroon)" }}>*</span>
              </label>
              {competitions.length === 0 ? (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "var(--color-cream)",
                    borderRadius: "4px",
                    fontSize: "13px",
                    color: "var(--color-slate)",
                  }}
                >
                  No active competitions are currently accepting registrations.
                </div>
              ) : (
                <select
                  value={competitionId}
                  onChange={(e) => setCompetitionId(e.target.value)}
                  required
                  style={{ width: "100%" }}
                >
                  {competitions.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} ({comp.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--color-navy)",
                    marginBottom: "6px",
                  }}
                >
                  Participant / Team Name <span style={{ color: "var(--color-maroon)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Chen or Team Phoenix"
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--color-navy)",
                    marginBottom: "6px",
                  }}
                >
                  Registration / Roll ID <span style={{ color: "var(--color-maroon)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={registrationId}
                  onChange={(e) => setRegistrationId(e.target.value)}
                  placeholder="e.g. REG-104 or 2024-CS-042"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--color-navy)",
                  marginBottom: "6px",
                }}
              >
                Official Email Address <span style={{ color: "var(--color-maroon)" }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. student@university.edu"
                required
              />
              <span style={{ fontSize: "11px", color: "var(--color-slate)", marginTop: "4px", display: "block" }}>
                Use the email registered during entry, or your primary contact address.
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--color-navy)",
                    marginBottom: "6px",
                  }}
                >
                  Password <span style={{ color: "var(--color-maroon)" }}>*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--color-navy)",
                    marginBottom: "6px",
                  }}
                >
                  Confirm Password <span style={{ color: "var(--color-maroon)" }}>*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--color-navy)",
                  marginBottom: "6px",
                }}
              >
                Team Members <span style={{ fontSize: "11px", color: "var(--color-slate)", fontWeight: 400 }}>(Optional for solo entries)</span>
              </label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="text"
                  value={teamMembersInput}
                  onChange={(e) => setTeamMembersInput(e.target.value)}
                  onKeyDown={handleKeyDownMember}
                  placeholder="Type member name and press Enter"
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

              {teamMembers.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                  {teamMembers.map((member, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "var(--color-cream)",
                        border: "1px solid var(--color-border)",
                        padding: "3px 10px",
                        borderRadius: "16px",
                        fontSize: "12px",
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
                          fontSize: "14px",
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-gold"
              disabled={submitting || competitions.length === 0}
              style={{ width: "100%", padding: "12px", fontSize: "15px", fontWeight: 700 }}
            >
              {submitting ? "Registering..." : "Complete Registration & Access Portal"}
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border-subtle)",
            fontSize: "13px",
            color: "var(--color-navy)",
            textAlign: "center",
          }}
        >
          Already registered?{" "}
          <Link
            to="/login"
            style={{
              color: "var(--color-navy)",
              fontWeight: 700,
              textDecoration: "underline",
            }}
          >
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
};
