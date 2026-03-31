import type { ReactNode } from "react";

export const Main = ({ classes = "", children }: { classes?: string; children?: ReactNode }) => {
  return (
    <div className={classes}>
      {children}
    </div>
  );
};
