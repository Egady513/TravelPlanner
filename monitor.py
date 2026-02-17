"""
Agent Monitoring Client
Simple API for agents to report their status to the dashboard
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

class AgentMonitor:
    """Monitor for tracking agent activity"""
    
    def __init__(self, status_file: Path = None):
        if status_file is None:
            status_file = Path(__file__).parent / "status.json"
        
        self.status_file = Path(status_file)
        self.status_file.parent.mkdir(parents=True, exist_ok=True)
        
        if not self.status_file.exists():
            self._save_state(self._get_initial_state())
    
    def _get_initial_state(self) -> Dict[str, Any]:
        return {
            "agents": [],
            "logs": [],
            "metrics": {
                "activeAgents": 0,
                "tokenUsage": 0,
                "pendingTasks": 0,
                "humanSteps": 0,
                "overallProgress": 0,
                "currentPhase": "Initialization",
                "eta": "Calculating..."
            }
        }
    
    def _load_state(self) -> Dict[str, Any]:
        try:
            with open(self.status_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return self._get_initial_state()
    
    def _save_state(self, state: Dict[str, Any]):
        with open(self.status_file, 'w') as f:
            json.dump(state, f, indent=2)
    
    def update_agent(
        self,
        agent_id: str,
        name: str,
        role: str,
        status: str = "active",
        current_task: Optional[str] = None,
        model: str = "claude-sonnet-4",
        tokens: int = 0
    ):
        """Update agent status"""
        state = self._load_state()
        
        agent = None
        for a in state["agents"]:
            if a["id"] == agent_id:
                agent = a
                break
        
        if agent is None:
            agent = {
                "id": agent_id,
                "name": name,
                "role": role,
                "model": model,
                "status": "idle",
                "currentTask": None,
                "tokens": 0,
                "lastActive": "Never"
            }
            state["agents"].append(agent)
        
        agent["status"] = status
        agent["currentTask"] = current_task
        agent["tokens"] = tokens
        agent["lastActive"] = "just now"
        
        state["metrics"]["activeAgents"] = sum(
            1 for a in state["agents"] if a["status"] == "active"
        )
        
        state["metrics"]["tokenUsage"] = sum(
            a.get("tokens", 0) for a in state["agents"]
        )
        
        self._save_state(state)
    
    def log_activity(self, agent_id: str, message: str):
        """Log agent activity"""
        state = self._load_state()
        
        state["logs"].append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "agent": agent_id,
            "message": message
        })
        
        if len(state["logs"]) > 100:
            state["logs"] = state["logs"][-100:]
        
        self._save_state(state)
    
    def update_metrics(
        self,
        pending_tasks: Optional[int] = None,
        human_steps: Optional[int] = None,
        progress: Optional[int] = None,
        phase: Optional[str] = None,
        eta: Optional[str] = None
    ):
        """Update overall metrics"""
        state = self._load_state()
        
        if pending_tasks is not None:
            state["metrics"]["pendingTasks"] = pending_tasks
        if human_steps is not None:
            state["metrics"]["humanSteps"] = human_steps
        if progress is not None:
            state["metrics"]["overallProgress"] = progress
        if phase is not None:
            state["metrics"]["currentPhase"] = phase
        if eta is not None:
            state["metrics"]["eta"] = eta
        
        self._save_state(state)
    
    def set_agent_idle(self, agent_id: str):
        """Set agent to idle status"""
        state = self._load_state()
        
        for agent in state["agents"]:
            if agent["id"] == agent_id:
                agent["status"] = "idle"
                agent["currentTask"] = None
                break
        
        state["metrics"]["activeAgents"] = sum(
            1 for a in state["agents"] if a["status"] == "active"
        )
        
        self._save_state(state)
