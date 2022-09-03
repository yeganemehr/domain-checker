import moment from "moment";
import fetch from "node-fetch";
import { singleton } from "tsyringe";

@singleton()
export default class ProxyListDownload {
	private list: Record<string, {
		reloadAt: Date;
		proxies: Array<{ host: string; port: number}>;
		faileds: Array<{ host: string; port: number; lastTry: Date }>;
	}> = {};

	public getSocks5() {
		return this.getProxyByType("socks5");
	}
	public getSocks4() {
		return this.getProxyByType("socks4");
	}

	public async getProxyByType(type: string): Promise<{ host: string; port: number } | undefined> {
		if (!this.list[type] || !this.list[type].proxies.length || moment(this.list[type].reloadAt).isBefore(moment().subtract(1, "hour"))) {
			await this.reloadList(type);
		}
		if (this.list[type] === undefined) {
			return undefined;
		}
		const i = Math.floor(Math.random() * this.list[type].proxies.length);
		return this.list[type].proxies[i];
	}

	public async reloadList(type: string) {
		const response = await fetch("https://www.proxy-list.download/api/v1/get?type=" + type);
		if (response.status !== 200) {
			throw new Error("ProxyList status code = " + response.status);
		}
		const body = await response.text();
		const list = body.split("\n");
		const proxies = list.map((address) => {
			const [host, port] = address.split(":");
			return { host, port: parseInt(port) };
		});
		if (this.list[type] === undefined) {
			this.list[type] = {
				reloadAt: new Date(),
				proxies,
				faileds: []
			};
		} else {
			this.list[type].reloadAt = new Date();
			this.list[type].proxies = proxies;
		}
	}

	public markAsFailed(type: string, proxy: {host: string;port:number}) {
		if (this.list[type] === undefined) {
			return;
		}
		this.list[type].faileds.push({
			host: proxy.host,
			port: proxy.port,
			lastTry: new Date(),
		});
		for (let x = 0, l = this.list[type].proxies.length; x < l; x++) {
			const p = this.list[type].proxies[x];
			if (p.host === proxy.host && p.port === proxy.port) {
				this.list[type].proxies.splice(x, 1);
				break;
			}
		}
	}
	
}