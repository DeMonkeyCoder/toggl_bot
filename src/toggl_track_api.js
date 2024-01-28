const dotenv = require("dotenv");
dotenv.config();
if (!process.env.TOGGL_TOKEN) {
  throw new Error("env.TOGGL_TOKEN is not set");
}

const axios = require("axios");

class TogglTrackAPI {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: "https://api.track.toggl.com/api/v9/",
      auth: {
        username: process.env.TOGGL_TOKEN,
        password: "api_token",
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
    this.default_workspace_id = undefined;
    this.projects = undefined;
  }

  async getWorkspaceId() {
    if (!this.default_workspace_id) {
      const { default_workspace_id } = await this.me();
      this.default_workspace_id = default_workspace_id;
    }
    return this.default_workspace_id;
  }

  async getProjectsFromApi() {
    const default_workspace_id = await this.getWorkspaceId();
    return this._get(`/workspaces/${default_workspace_id}/projects`);
  }
  async getProjects() {
    if (!this.projects) {
      this.projects = await this.getProjectsFromApi();
    }
    return this.projects;
  }
  async _get(path) {
    const response = await this.axiosInstance.get(path);
    return response.data;
  }
  async _delete(path) {
    const response = await this.axiosInstance.delete(path);
    return response.data;
  }
  async _post(path, data = {}) {
    const response = await this.axiosInstance.post(path, data);
    return response.data;
  }
  async _put(path, data = {}) {
    const response = await this.axiosInstance.put(path, data);
    return response.data;
  }
  async me() {
    return this._get("/me");
  }
  currentTimer = () => {
    return this._get("/me/time_entries/current");
  }
  async project(pid) {
    const projects = await this.getProjects();
    return projects.find(p => p.id === pid);
  }
  async projectsString() {
    const projects = await this.getProjectsFromApi();
    return projects.map(p => `${p.name} \`p${p.id}\``).join('\n');
  }
  async startTracking({start, pid}) {
    const default_workspace_id = await this.getWorkspaceId();
    return this._post(`/workspaces/${default_workspace_id}/time_entries`, {
      start,
      pid,
      created_with: 'mytelegrambot',
      duration: -1,
      wid: default_workspace_id
    });
  }
  async stopTracking(time_entry, time) {
    const default_workspace_id = await this.getWorkspaceId();
    return this._put(`/workspaces/${default_workspace_id}/time_entries/${time_entry.id}`, {
      ...time_entry,
      duration: undefined,
      stop: time
    });
  }
  async discardTracking(time_entry, time) {
    const default_workspace_id = await this.getWorkspaceId();
    return this._delete(`/workspaces/${default_workspace_id}/time_entries/${time_entry.id}`);
  }
}

module.exports = new TogglTrackAPI();
