"use client";

import { useState } from "react";

import { Icon } from "./icon";

type ProjectView = "grid" | "list";

const navigation = ["Dashboard", "All Projects", "Settings"] as const;

export function ProjectsShell(): React.JSX.Element {
  const [view, setView] = useState<ProjectView>("grid");
  const [activeItem, setActiveItem] = useState<(typeof navigation)[number]>("All Projects");

  return (
    <main className="builder-shell">
      <header className="builder-header">
        <a aria-label="Nextomic home" className="brand-mark" href="/projects">
          N
        </a>
        <p className="welcome">Welcome to Nextomic</p>
        <div className="header-actions">
          <button aria-label="Search projects" className="icon-button" type="button">
            <Icon name="search" width="20" />
          </button>
          <button aria-label="Switch workspace" className="icon-button" type="button">
            <Icon name="apps" width="20" />
          </button>
          <a aria-label="Open settings" className="icon-button" href="/settings">
            <Icon name="settings" width="20" />
          </a>
          <button aria-label="Open account menu" className="avatar-button" type="button">
            <Icon name="user" width="24" />
          </button>
        </div>
      </header>

      <div className="builder-layout">
        <nav aria-label="Primary" className="sidebar">
          {navigation.map((item) => (
            <button
              className={activeItem === item ? "nav-item nav-item-active" : "nav-item"}
              key={item}
              onClick={() => setActiveItem(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>

        <section aria-labelledby="projects-heading" className="projects-content">
          <div className="projects-title-row">
            <div>
              <h1 id="projects-heading">All Projects</h1>
              <span className="workspace-badge">Your Workspace</span>
            </div>
            <button className="primary-button" type="button">
              <Icon name="plus" width="18" /> New Project
            </button>
          </div>

          <div className="project-toolbar">
            <label className="search-field">
              <Icon name="search" width="18" />
              <span className="sr-only">Search projects</span>
              <input placeholder="Search projects" type="search" />
            </label>
            <button className="secondary-button" type="button">
              <Icon name="calendar" width="18" /> Date range
            </button>
            <div aria-label="Project view" className="view-toggle" role="group">
              <button
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className={view === "grid" ? "view-button selected" : "view-button"}
                onClick={() => setView("grid")}
                type="button"
              >
                <Icon name="grid" width="18" />
              </button>
              <button
                aria-label="List view"
                aria-pressed={view === "list"}
                className={view === "list" ? "view-button selected" : "view-button"}
                onClick={() => setView("list")}
                type="button"
              >
                <Icon name="list" width="18" />
              </button>
            </div>
          </div>

          <div className={view === "grid" ? "empty-projects empty-projects-grid" : "empty-projects"}>
            <Icon name="logo" width="42" />
            <h2>Create your first project</h2>
            <p>Start with a blank Nextomic project. Pages, templates, and generated output arrive in later phases.</p>
            <button className="primary-button" type="button">
              <Icon name="plus" width="18" /> New Project
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
