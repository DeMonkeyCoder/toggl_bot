const dotenv = require("dotenv");
dotenv.config();

const axios = require("axios");

if (!process.env.TOGGL_TOKEN) {
  throw new Error("env.TOGGL_TOKEN is not set");
}

class TogglTrackAPI {
  static axiosInstance = axios.create({
    baseURL: "https://api.track.toggl.com/api/v9/",
    auth: {
      username: process.env.TOGGL_TOKEN,
      password: "api_token",
    },
    headers: {
      "Content-Type": "application/json",
    },
  });

  static async _get(path) {
    const response = await this.axiosInstance.get(path);
    return response.data;
  }
  static async _delete(path) {
    const response = await this.axiosInstance.delete(path);
    return response.data;
  }

  static async _post(path, data = {}) {
    const response = await this.axiosInstance.post(path, data);
    return response.data;
  }
  static async _patch(path, data = {}) {
    const response = await this.axiosInstance.patch(path, data);
    return response.data;
  }
  static async _put(path, data = {}) {
    const response = await this.axiosInstance.put(path, data);
    return response.data;
  }

  static me() {
    return this._get("/me");
  }

  static currentTimer = () => {
    return this._get("/me/time_entries/current");
  }

  static async projects() {
    const { default_workspace_id } = await this.me();
    return this._get("/workspaces/" + default_workspace_id + "/projects");
  }

  static async project(pid) {
    const { default_workspace_id } = await this.me();
    return this._get("/workspaces/" + default_workspace_id + "/projects/" + pid);
  }

  static async projectsString() {
    const projects = await this.projects();
    return projects.map(p => p.name + ' `p' + p.id + '`').join('\n');
  }

  static async startTracking({start, pid}) {
    const { default_workspace_id } = await this.me();
    return await this._post("/workspaces/" + default_workspace_id + "/time_entries", {start, pid, created_with: 'mytelegrambot', duration: -1, wid: default_workspace_id});
  }
  static async stopTracking(time_entry, time) {
    const { default_workspace_id } = await this.me();
    return await this._put("/workspaces/" + default_workspace_id + "/time_entries/" + time_entry.id, {
      ...time_entry,
      duration: undefined,
      stop: time,
    });
  }
  static async discardTracking(time_entry, time) {
    const { default_workspace_id } = await this.me();
    return await this._delete("/workspaces/" + default_workspace_id + "/time_entries/" + time_entry.id);
  }
}

module.exports = TogglTrackAPI;
