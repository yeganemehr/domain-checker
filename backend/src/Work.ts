export default abstract class Work<T = any> {
  public abstract do(): Promise<T>;
}
