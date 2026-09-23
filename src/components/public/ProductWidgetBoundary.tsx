"use client";

import React from "react";

interface Props {
  name: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Keeps a single optional PDP widget from taking down the complete product
 * page during client hydration. Server data failures are handled in page.tsx.
 */
export class ProductWidgetBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[product-widget:${this.props.name}]`, error, info);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
