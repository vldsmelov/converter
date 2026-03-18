import React from "react";

export default function PageHeader(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="row page-header">
      <div>
        <h3 className="page-header-title">{props.title}</h3>
        {props.subtitle ? <small className="page-header-subtitle">{props.subtitle}</small> : null}
      </div>
      <div className="row page-header-actions">{props.right}</div>
    </div>
  );
}
