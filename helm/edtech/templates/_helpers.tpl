{{- define "edtech.labels" -}}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "edtech.serviceLabels" -}}
{{ include "edtech.labels" .context }}
app.kubernetes.io/name: {{ .name }}
{{- end -}}

{{- define "edtech.selectorLabels" -}}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/name: {{ .name }}
{{- end -}}

{{- define "edtech.renderEnv" -}}
{{- range $key, $value := . }}
- name: {{ $key }}
  value: {{ $value | quote }}
{{- end }}
{{- end -}}
