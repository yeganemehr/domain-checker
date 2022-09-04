import Work from "./Work";
import Config from "./Config";
import { container } from "tsyringe";
import fetch from "node-fetch";
import net, { Socket } from "net";
import { SocksClient } from 'socks';
import ProxyListDownload from "./ProxyListDownload";
import { SocksProxyType } from "socks/typings/common/constants";
import {Resolver} from "dns/promises";

export interface IResult {
	available: boolean;
}

export default class CheckDomainWork extends Work {
	public constructor(
		public readonly domain: string,
	) {
		super();
	}

	public async do(): Promise<IResult> {
		const tld = this.domain.substring(this.domain.lastIndexOf(".") + 1);
		const rdapServer = this.getRdapURL(tld);
		if (rdapServer) {
			const response = await fetch(`${rdapServer}/domain/${this.domain}`, {
				headers: {
					Accept: "application/rdp+json"
				}
			});
			if (response.status === 404) {
				return {
					available: true
				};
			}
			return {
				available: false
			};
		}
		const dnsCheck = await this.checkViaDNS(this.domain);
		if (dnsCheck) {
			try {
				const result = await this.whoisDomain(this.domain);
				if (tld === "ir") {
					return {
						available: result.includes("no entries found")
					};
				}
			} catch (e) {
			}
		}
		return {
			available: dnsCheck
		};
	}

	private async checkViaDNS(domain: string): Promise<boolean> {
		const resolver = new Resolver();
		if (domain.endsWith(".ir")) {
			resolver.setServers([
				"193.171.255.77",
				"193.189.123.2",
				"193.0.9.85",
				"193.189.122.83",
				"78.104.145.5",
			]);
		}
		try {
			const ns = await resolver.resolveNs(domain);
			return ns.length === 0;
		} catch (e) {
			if (e instanceof Error && e.hasOwnProperty("code") && (e as any).code === "ENOTFOUND") {
				return true;
			}
			throw e;
		}
	}

	public getRdapURL(tld: string): string | undefined {
		const config = container.resolve(Config);
		return config.data.rdap.tlds[tld];
	}

	private whoisDomain(domain: string) {
		const tld = this.domain.substring(this.domain.lastIndexOf(".") + 1);
		const config = container.resolve(Config);
		const whoisServer = config.data.whois.tlds[tld];
		if (whoisServer === undefined) {
			throw new Error("Cannot find whois server");
		}
		const [host, port] = whoisServer.split(":");
		return this.whoisQuery(host, parseInt(port), 5000, domain + "\r\n", true);
	}

	private whoisQuery(host: string, port: number, timeout: number, query: string, useProxy: boolean): Promise<string> {
		return new Promise(async (resolve, reject) => {

			let data = '';
			let socket: Socket;
			if (useProxy) {
				socket = await this.connectViaProxy(host, port);
			} else {
				socket = await this.connectDirectly(host, port);
			}
			socket.setTimeout(timeout);
			socket.write(query);
			socket.on('data', (chunk: string) => (data += chunk));
			socket.on('close', () => resolve(data));
			socket.on('timeout', () => socket.destroy(new Error('Timeout')));
			socket.on('error', reject);
		})
	}

	private async connectViaProxy(host: string, port: number) {
		while (true) {
			const proxyProvider = container.resolve(ProxyListDownload);
			let proxy = {
				type: 4,
				address: await proxyProvider.getSocks4(),
			};
			if (proxy.address === undefined) {
				proxy = {
					type: 5,
					address: await proxyProvider.getSocks5(),
				};
			}
			if (proxy.address === undefined) {
				throw new Error("Cannot find proxy");
			}
			try {
				const info = await SocksClient.createConnection({
					command: "connect",
					destination: { host, port },
					timeout: 5000,
					proxy: {
						type: proxy.type as SocksProxyType,
						ipaddress: proxy.address.host,
						port: proxy.address.port
					}
				});
				return info.socket;
			} catch (e) {
				console.error(e);
				proxyProvider.markAsFailed(`socks${proxy.type}`, proxy.address);
			}
		}
	}

	private connectDirectly(host: string, port: number): Promise<Socket> {
		return new Promise((resolve, reject) => {
			const socket = net.connect(port, host);
			socket.once("connect", () => resolve(socket));
			socket.once("error", reject);
		});
	}
}
