import React from "react";

export default function PageHeader(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <h3 style={{ margin: 0 }}>{props.title}</h3>
        {props.subtitle ? <small>{props.subtitle}</small> : null}
      </div>
      <div className="row" style={{ gap: 8 }}>{props.right}</div>
    </div>
  );
}
