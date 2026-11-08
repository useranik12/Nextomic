"use client";

import { Checkbox, Switch } from "@heroui/react";
import type { RestCall, RestResponse } from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { useEditorStore } from "../store/editor-store";
import { JsonPaths } from "./json-paths";

const NONE = "none";

/** "Response Type": read the response as a data type, and named JSON paths into it. */
export function ResponseType({
  call,
  onChange,
  json
}: {
  call: RestCall;
  onChange: (next: RestCall) => void;
  /** The last test response, for previews and recommendations (never saved). */
  json: unknown;
}) {
  const dataTypes = useEditorStore((s) => s.project.dataTypes);
  const response = call.response;
  const set = (patch: Partial<RestResponse>) =>
    onChange({ ...call, response: { ...response, ...patch } });

  return (
    <section
      aria-label="Response Type"
      className="flex flex-col gap-5 rounded-large border border-default-200 p-5"
    >
      <h3 className="text-small font-medium text-foreground">Response Type</h3>
      <div className="flex flex-col gap-3 border-b border-divider pb-5">
        <div className="flex items-center gap-1.5">
          <Switch
            size="sm"
            isSelected={response.parseAsDataType}
            onValueChange={(parseAsDataType) => set({ parseAsDataType })}
          >
            <span className="text-small">Parse as Data Type</span>
          </Switch>
          <InfoTip
            label="Parse as Data Type"
            text="Reads the whole response as one of the app's data types (Data Types page), so its fields are typed in dynamic data."
          />
        </div>
        {response.parseAsDataType ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <SelectField
                compact
                label="Data Type"
                value={response.dataTypeId || NONE}
                isDisabled={dataTypes.length === 0}
                description={
                  dataTypes.length === 0
                    ? "Add a data type on the Data Types page first."
                    : undefined
                }
                options={[
                  { value: NONE, label: "No data type selected" },
                  ...dataTypes.map((d) => ({ value: d.id, label: d.name }))
                ]}
                onValueChange={(v) => set({ dataTypeId: v === NONE ? "" : v })}
              />
            </div>
            <Checkbox
              size="sm"
              isSelected={response.isList}
              onValueChange={(isList) => set({ isList })}
            >
              <span className="text-small">Is List</span>
            </Checkbox>
          </div>
        ) : null}
      </div>
      <JsonPaths
        paths={response.jsonPaths}
        json={json}
        onChange={(jsonPaths) => set({ jsonPaths })}
      />
    </section>
  );
}
