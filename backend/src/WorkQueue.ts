import { EventEmitter } from 'events';
import Work from './Work';

interface IPromiseCallbacks {
  resolve: (value: any) => any;
  reject: (reason?: any) => void
}

export interface WorkQueue {
  on(event: 'added', listener: (work: Work) => void): this;
  on(event: 'started', listener: (work: Work) => void): this;
  on(event: 'done', listener: (work: Work) => void): this;
  on(event: 'failed', listener: (work: Work) => void): this;
  on(event: 'finished', listener: (work: Work) => void): this;
  on(event: 'empty', listener: () => void): this;
  on(event: 'idle', listener: () => void): this;
}

export class WorkQueue extends EventEmitter {
  protected queue: Work[] = [];

  protected promises: IPromiseCallbacks[] = [];

  protected running = 0;

  protected maxRunning = 1;

  public constructor() {
    super();
  }

  public enqueue<T>(work: Work<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(work);
      this.promises.push({ resolve, reject });
      this.emit('added', work);
      this.runLater();
    });
  }

  public length() {
    return this.queue.length;
  }

  public setMaxRunning(maxRunning: number): this {
    this.maxRunning = maxRunning;
    return this;
  }

  public getMaxRunning(): number {
    return this.maxRunning;
  }

  public getRunning(): number {
    return this.running;
  }

  public isIddle(): boolean {
    return this.running + this.queue.length === 0;
  }

  public clear(): void {
    this.queue = [];
    for (const p of this.promises) {
      p.reject("canceled");
    }
    this.promises = [];
  }

  public isUnderload(): boolean {
    return this.running + this.queue.length < this.maxRunning;
  }

  public isOverload(): boolean {
    return this.running + this.queue.length >= this.maxRunning;
  }

  public async stop(): Promise<void> {
    this.clear();
    if (this.running > 0) {
      return new Promise((resolve) => {
        this.once("idle", resolve);
      });
    }
  }

  private run() {
    if (this.queue.length === 0) {
      return;
    }
    if (this.running >= this.maxRunning) {
      return;
    }

    const work = this.queue.shift();
    if (work === undefined) {
      return;
    }
    const promise = this.promises.shift();
    if (promise === undefined) {
      return;
    }


    this.running++;
    this.emit('started', work);
    work.do().then((value) => {
      promise.resolve(value);
      this.emit('done', work);
    }, (reason) => {
      promise.reject(reason);
      this.emit('failed', work);
    }).finally(() => {
      this.emit('finished', work);
      this.running--;
      if (!this.running && !this.queue.length) {
        this.emit('idle');
      }
      this.runLater();
    });
    if (this.queue.length === 0) {
      this.emit('empty');
    }
  }

  private runLater() {
    process.nextTick(() => {
      this.run();
    });
  }
}
