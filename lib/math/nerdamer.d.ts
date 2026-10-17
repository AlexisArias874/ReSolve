declare module "nerdamer/all.min" {
  interface NerdamerResult {
    toString(): string;
  }
  interface Nerdamer {
    (expr: string, ...args: (string | number)[]): NerdamerResult;
    solveEquations?: (
      equations: string[],
      variables: string[]
    ) => Array<[string, string | number]>;
    version?: string;
  }
  const nerdamer: Nerdamer;
  export default nerdamer;
}
