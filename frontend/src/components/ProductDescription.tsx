"use client";

import { useState } from "react";

function formatDescription(text: string) {
  if (!text) return "";

  return text
    // Bold markdown
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Convert line breaks
    .replace(/\n/g, "<br/>")
    // Convert bullet dashes to real bullets
    .replace(/- (.*?)(<br\/>)/g, "• $1<br/>");
}

export default function ProductDescription({
  description,
}: {
  description: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!description?.trim()) {
    return null;
  }

  const formatted = formatDescription(description);

  return (
    <div className="productDescriptionWrapper">
      <h3 className="productDescriptionTitle">About this product</h3>

      <div
        className={`productDescriptionText ${
          expanded ? "expanded" : "collapsed"
        }`}
        dangerouslySetInnerHTML={{ __html: formatted }}
      />

      <button
        className="productDescriptionToggle"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}
