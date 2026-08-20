"use client";

import { useState, type ReactNode } from "react";

export type MasterTab = {
  id: string;
  label: string;
  /** 좁은 화면에서 대신 보여줄 짧은 이름. 여섯 탭이 한 줄에 들어가게 한다.
   *  읽어주는 이름은 언제나 label이므로 여기서 뜻이 좁아져도 상관없다. */
  shortLabel: string;
  description: string;
  kind?: "achievements" | "standard" | "limits" | "diagnosis";
  content: ReactNode;
};

type MasterTabsProps = {
  tabs: MasterTab[];
  title: string;
  headingId: string;
  footer?: ReactNode;
};

export default function MasterTabs({ tabs, title, headingId, footer }: MasterTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0].id);
  /** 새 장이 들어오는 방향. 오른쪽 인덱스를 고르면 오른쪽에서 들어와야
   *  어느 쪽으로 넘겼는지가 남는다. */
  const [dir, setDir] = useState<"next" | "prev">("next");

  const select = (id: string) => {
    if (id === activeId) return;
    const from = tabs.findIndex((tab) => tab.id === activeId);
    const to = tabs.findIndex((tab) => tab.id === id);
    setDir(to > from ? "next" : "prev");
    setActiveId(id);
  };

  return (
    <div className="master-file" data-active-tab={activeId} data-dir={dir}>
      {/* 파일 윗변. 아래 노란 몸통보다 먼저 와야 몸통이 이 밑동을 덮고,
       *  인덱스가 밑동만 잘려 파일에 꽂힌 모양이 된다. 제목은 화면에서는
       *  빼지만 이 영역의 이름이라 지우지 않고 읽기용으로만 남긴다. */}
      <div className="master-file-edge">
        <h2 id={headingId} className="visually-hidden">
          {title}
        </h2>

        <div className="master-tablist" role="tablist" aria-label={`${title} 목차`}>
          {tabs.map((tab) => {
            const selected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`master-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`master-tabpanel-${tab.id}`}
                className="master-tab"
                aria-label={tab.label}
                onClick={() => select(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(tab.id);
                  }
                }}
              >
                <span className="master-tab-name-full">{tab.label}</span>
                <span className="master-tab-name-short">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="master-tabs">
        <div className="master-folder">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              id={`master-tabpanel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`master-tab-${tab.id}`}
              tabIndex={0}
              className="master-tabpanel"
              data-kind={tab.kind ?? "standard"}
              hidden={tab.id !== activeId}
            >
              {/* 번호는 인덱스에서 뺐으니 여기서도 뺀다. 남겨 두면 이름은
               *  탭에서, 번호는 여기서 세는 꼴이 된다. */}
              <header className="master-tabpanel-header">
                <h3>{tab.label}</h3>
                <p>{tab.description}</p>
              </header>
              <div className="master-tabpanel-content">{tab.content}</div>
            </div>
          ))}
          {footer ? <footer className="master-file-footer">{footer}</footer> : null}
        </div>
      </div>
    </div>
  );
}
