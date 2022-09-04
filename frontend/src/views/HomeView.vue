<template>
  <div>
    <v-row align="end" justify="center" style="min-height: 50vh;" no-gutters>
      <v-col cols="6">
        <v-row>
          <v-col>
            <h1 class="text-center mb-6">{{ running ? "Here we go..." : "Find your new domain here!" }} </h1>
            <v-text-field label="Domain name pattern" variant="outlined" :placeholder="inputPlaceholder"
              :hint="inputHint" :persistent-hint="inputHint !== undefined" :append-inner-icon="regexIcon"
              :readonly="running" :onClick:appendInner="onRegexToggleClick" @change="(e) => onInputChange(e, true)"
              v-model="pattern" :error="patternError !== undefined">
            </v-text-field>
            <div v-if="!running && !isRegex" class="help-block">
              <strong>*</strong> Means alphabetic([a-z]), numberics ([0-9]) and dash (-) characters.<br />
              <strong>%w</strong> Means alphabetic characters ([a-z]).<br />
              <strong>%d</strong> Means numberics characters ([0-9]).<br />
            </div>
            <div v-if="!running && examples.length" class="examples">
              Examples:
              <span class="domain-example" :class="!isValidDomain(domain) ? 'invalid-domain' : ''"
                v-for="(domain, i) in examples" :key="'example-' + i">{{ domain }}</span>
            </div>
            <div class="text-center mt-5">
              <v-btn prepend :prepend-icon="actionBtnIcon" variant="outlined" @click="onActionBtnClick"
                :disabled="patternError !== undefined || !pattern || actionRunning">{{ running
                    ?
                    "Stop" : "Start"
                }}</v-btn>
            </div>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <v-row v-if="Object.keys(checks).length > 0" justify="center" no-gutters>
      <v-col cols="6">
        <div class="checks">
          <div class="header">
            <strong>{{ checksHeaderTitle }}:</strong>
            <v-btn prepend-icon="mdi-download" variant="outlined" size="x-small" class="btn-download"
              :disabled="!downloadBtnStatus" color="secondery" :href="downloadURL">Download</v-btn>
          </div>
          <div class="check" v-for="check in lastestChecks" :key="'check-' + check.domain">
            <div class="status">
              <v-icon :icon="getCheckIcon(check)" size="x-small" :color="getCheckColor(check)" />
            </div>
            <div class="domain">{{ check.domain }}</div>
            <div class="time">{{ formatCheckTime(check) }}</div>
          </div>
        </div>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import moment from "moment";
import { expand } from 'regex-to-strings';
import { io, Socket } from "socket.io-client";

export enum DomainScanStatus {
  RUNNING,
  AVAILABLE,
  TAKEN,
}
interface ICheck {
  status: DomainScanStatus;
  modifiedAt: number;
}

interface IData {
  actionRunning: boolean;
  pattern: string;
  patternError?: string;
  running: boolean;
  isRegex: boolean;
  count: number;
  examples: string[];
  checks: Record<string, ICheck>;
  socket?: Socket;
}
interface IServerUpdateCheck {
  domain: string;
  modifiedAt: number;
  status: DomainScanStatus;
}
interface IServerScanStatusResponse {
  running: boolean;
  pattern?: string;
  isRegex?: boolean;
  checks?: Record<string, Exclude<IServerUpdateCheck, "domain">>
}

export default defineComponent({
  name: 'HomeView',
  data: (): IData => {
    return {
      actionRunning: true,
      pattern: '',
      patternError: undefined,
      running: false,
      isRegex: false,
      count: 0,
      examples: [],
      socket: undefined,
      checks: {},
    }
  },
  computed: {
    downloadBtnStatus(): boolean {
      return !this.actionRunning && Object.values(this.checks).some((c) => c.status === DomainScanStatus.AVAILABLE);
    },
    downloadURL(): string {
      return (process.env.VUE_APP_SERVER_URL || "") + "/api/v1/scan/download";
    },
    inputPlaceholder(): string {
      return this.isRegex ? "^ab[a-z0-9]{3}.com$" : "ab***.com";
    },
    regexIcon(): string {
      return this.isRegex ? "mdi-code-braces" : "mdi-regex";
    },
    inputHint(): string | undefined {
      if (this.patternError) {
        return this.patternError;
      }
      if (this.count) {
        return `Found ${this.count.toLocaleString()} possible domains`;
      }
      return undefined;
    },
    checksHeaderTitle(): string {
      let availables = 0;
      for (const check of Object.values(this.checks)) {
        if (check.status === DomainScanStatus.AVAILABLE) {
          availables++;
        }
      }
      if (availables) {
        return `Found ${availables} available domain`;
      }
      if (this.running) {
        return "Looking for our first winner";
      }
      return "Unfortunately we couldn't find any available domain";
    },
    actionBtnIcon(): string {
      if (this.actionRunning) {
        return "mdi-loading mdi-spin";
      }
      return "mdi-database-search";
    },
    lastestChecks(): IServerUpdateCheck[] {
      const checks: IServerUpdateCheck[] = [];
      for (const domain in this.checks) {
        const check = this.checks[domain];
        if (check.status === DomainScanStatus.AVAILABLE || check.status === DomainScanStatus.RUNNING) {
          checks.push({ domain, ...check });
        }
      }
      checks.sort((a, b) => {
        return b.modifiedAt - a.modifiedAt;
      });
      return checks;
    }
  },
  methods: {
    async onActionBtnClick() {
      this.actionRunning = true;
      try {
        const isStart = !this.running;
        const response = await fetch(`${process.env.VUE_APP_SERVER_URL || ""}/api/v1/scan/${isStart ? "start" : "stop"}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            pattern: this.pattern,
            isRegex: this.isRegex,
          })
        });
        const data: IServerScanStatusResponse = await response.json();
        if (response.status !== 200) {
          throw new Error();
        }
        if (isStart) {
          this.checks = {};
          this.running = true;
        }
      } finally {
        this.actionRunning = false;
      }
    },
    onRegexToggleClick() {
      if (this.running) {
        return;
      }
      this.isRegex = !this.isRegex;
      this.onInputChange(undefined, true);
    },
    getCheckIcon(check: ICheck) {
      switch (check.status) {
        case DomainScanStatus.AVAILABLE:
          return "mdi-check";
        case DomainScanStatus.RUNNING:
          return "mdi-loading mdi-spin";
        case DomainScanStatus.TAKEN:
          return "mdi-close";
      }
    },
    getCheckColor(check: ICheck) {
      switch (check.status) {
        case DomainScanStatus.AVAILABLE:
          return "success";
        case DomainScanStatus.RUNNING:
          return "warning";
        case DomainScanStatus.TAKEN:
          return "error";
      }
    },
    formatCheckTime(check: ICheck) {
      return moment(check.modifiedAt).format("YYYY/MM/DD hh:mm:ss");
    },
    onInputChange(payload?: Event, runChecks = false) {
      if (!this.pattern) {
        this.patternError = undefined;
        this.examples = [];
        return;
      }
      let regex: RegExp;
      try {
        regex = this.convertPatternToRegex(this.pattern, this.isRegex);
      } catch (e) {
        this.patternError = "Invalid Pattern";
        return;
      }
      console.log("regex", regex);
      const expander = expand(regex);
      this.count = expander.count;

      this.examples = [];
      const maxExamples = 15;
      const maxSamples = (runChecks && this.count <= 1000000) ? 1000 : maxExamples;
      let badDomains = 0;
      let x = 0;
      for (const domain of expander.getIterator()) {
        if (x >= maxSamples) {
          break;
        }
        if (this.isValidDomain(domain)) {
          this.examples.push(domain);
        } else {
          this.examples.unshift(domain);
          console.log("bad-domain", domain);
          badDomains++;
          if (badDomains >= maxExamples) {
            break;
          }
        }
        x++;
      }
      this.examples.splice(0, this.examples.length - maxExamples);

      if (this.count > 1000000 && runChecks) {
        this.patternError = "This pattern make more than a milion domain names";
        return;
      }

      if (badDomains) {
        this.patternError = "This pattern make invalid domain names";
        return;
      }
      this.patternError = undefined;
    },
    convertPatternToRegex(pattern: string, isRegex: boolean): RegExp {
      let regex: RegExp;
      if (isRegex) {
        regex = new RegExp(pattern);
      } else {
        pattern = pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\\\./g, "[a-z0-9]\\.")
          .replace(/\\\.\*/g, "\\.[a-z0-9]")
          .replace(/\*-/g, "[a-z0-9]-")
          .replace(/-\*/g, "-[a-z0-9]")
          .replace(/^\*/g, "[a-z0-9]")
          .replace(/\*$/g, "[a-z0-9]")
          .replace(/\*/g, "[a-z0-9-]")
          .replace(/%d/g, "[0-9]")
          .replace(/%w/g, "[a-z]")
          .replace(/%s/g, "-");
        regex = new RegExp(`^${pattern}$`);
      }
      return regex;
    },
    initSocket() {
      const opts = {
        transports: ['websocket'],
        upgrade: false
      };
      let socket: Socket;
      if (process.env.VUE_APP_SOCKET_URL) {
        socket = io(process.env.VUE_APP_SOCKET_URL, opts);
      } else {
        socket = io(opts);
      }
      socket.on("connect", () => {
        this.actionRunning = false;
      });
      socket.on("disconnect", () => {
        this.actionRunning = true;
      });
      socket.on("scan.state", (update: IServerScanStatusResponse) => {
        console.log("scan.state", update);
        this.reloadStatusFromData(update);
      });
      socket.on("scan.check", (check: IServerUpdateCheck) => {
        console.log("scan.check", check);
        this.checks[check.domain] = {
          modifiedAt: check.modifiedAt,
          status: check.status,
        };
      });
    },
    async reloadStatusFromServer() {
      const response = await fetch(`${process.env.VUE_APP_SERVER_URL || ""}/api/v1/scan`);
      const data: IServerScanStatusResponse = await response.json();
      this.reloadStatusFromData(data);
    },
    reloadStatusFromData(data: IServerScanStatusResponse) {
      this.running = data.running;
      if (data.pattern !== undefined) {
        this.pattern = data.pattern;
      }
      if (data.isRegex !== undefined) {
        this.isRegex = data.isRegex === true;
      }
      if (data.pattern !== undefined && data.isRegex !== undefined) {
        this.onInputChange(undefined, false);
      }
      if (data.checks !== undefined) {
        this.checks = data.checks;
      }
    },
    isValidDomain(domain: string): boolean {
      const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      return regex.test(domain);
    }
  },
  async mounted() {
    this.initSocket();
  }

});
</script>
<style lang="scss">
@import '~vuetify/lib/styles/main.sass';

.examples,
.help-block {
  opacity: var(--v-medium-emphasis-opacity);
  padding-left: 16px;
  margin-top: 12px;
  font-size: 12px;
}

.help-block strong {
  display: inline-block;
  width: 20px;
  text-align: center;
}

.examples .domain-example {
  padding: 2px 4px;
  background: #aaa;
  display: inline-block;
  margin: 2px 5px;

  &.invalid-domain {
    background: #aaa;
    color: rgb(var(--v-theme-error));
    border-left: 2px rgb(var(--v-theme-error)) solid;
  }
}

.v-field__append-inner {
  cursor: pointer;
}

.checks {
  .header {
    .btn-download {
      float: right;
    }

    margin-bottom: 20px;
  }
}

.check {
  opacity: var(--v-medium-emphasis-opacity);

  .domain,
  .time,
  .status {
    display: inline-block;
  }

  .status {
    margin-right: 5px;
  }

  .time {
    float: right;
  }
}
</style>