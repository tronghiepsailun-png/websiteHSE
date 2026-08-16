# HSE Enterprise Design System

Nguồn tham chiếu thiết kế chính thức của Nền tảng Quản lý HSE. **Đọc file này trước khi
xây bất kỳ module mới nào.** Mọi module mới phải dùng đúng các token/component/quy tắc
dưới đây thay vì tự tạo style riêng.

Tài liệu này được xây dựng **song song với việc triển khai Phase 1** (không phải viết
trước rồi mới làm) — mỗi mục dưới đây phản ánh quy tắc đã thực sự áp dụng vào code, không
phải mong muốn lý thuyết. Sẽ được bổ sung tiếp qua các bước F4–F6.

## HSE Product Principles

Nguyên tắc sản phẩm áp dụng cho mọi module, mọi quyết định thiết kế:

- **SAFETY FIRST** — thông tin an toàn luôn được ưu tiên hiển thị trước thông tin vận hành thông thường.
- **COMPLIANCE FIRST** — trạng thái tuân thủ/không tuân thủ phải rõ ràng, không mập mờ.
- **RISK VISIBILITY** — rủi ro (quá hạn, thiếu hồ sơ, sự cố nghiêm trọng) phải nổi bật ngay khi nhìn vào, không cần tìm kiếm.
- **ACTION ORIENTED** — mỗi cảnh báo phải dẫn tới hành động cụ thể có thể làm ngay (không hiển thị số liệu vô nghĩa).
- **DATA CLARITY** — số liệu quan trọng hiển thị trực tiếp, không bắt hover mới thấy (đã áp dụng: mọi chart hiện có).
- **TRACEABILITY** — mọi thay đổi dữ liệu quan trọng phải có lịch sử (đã áp dụng: PCCC version history, Incident audit log).
- **CONSISTENCY** — cùng một loại thông tin phải trông giống nhau ở mọi module (đây là lý do file này tồn tại).
- **EXECUTIVE READABILITY** — dashboard phải "screenshot-ready": chụp màn hình gửi Giám đốc vẫn hiểu được ngay.

### Thứ tự ưu tiên hiển thị thông tin (HSE-First priority)

Khi một màn hình có nhiều loại thông tin cạnh tranh sự chú ý, thứ tự ưu tiên thị giác là:

1. Rủi ro nghiêm trọng (sự cố mức A, hồ sơ quá hạn, vi phạm nghiêm trọng)
2. Không tuân thủ / thiếu hồ sơ
3. Quá hạn (CAPA, PCCC, đào tạo)
4. Sắp đến hạn
5. Cần hành động (workflow đang mở/đang xử lý)
6. Thông tin tham khảo (dữ liệu tĩnh, lịch sử)

**Không lạm dụng màu đỏ** — chỉ dùng màu cảnh báo khi thực sự có ý nghĩa rủi ro (xem "Color tokens" bên dưới).

## Color tokens (F2 — hoàn thành)

4 tông màu ngữ nghĩa (semantic status tone), định nghĩa tại `src/app/globals.css`
(`--success`, `--warning`, tái sử dụng `--destructive` có sẵn cho "critical", tái sử
dụng `--muted`/`--muted-foreground` cho "neutral") và các class dùng chung tại
`src/lib/status-tone.ts`:

| Tone | Ý nghĩa | Token | Dùng khi nào |
|---|---|---|---|
| `success` | Đạt/Đủ/Còn hạn/Hoàn thành | `--success` | Trạng thái tốt, không cần hành động |
| `warning` | Cần cập nhật/Sắp đến hạn/Đang xử lý | `--warning` | Cần chú ý, chưa khẩn cấp |
| `critical` | Thiếu/Quá hạn/Vi phạm | `--destructive` | Rủi ro thật, cần hành động ngay |
| `neutral` | Không áp dụng/Không định kỳ | `--muted-foreground` | Thông tin trung tính |

5 hình dạng dùng chung trong `src/lib/status-tone.ts` — **luôn import từ đây, không tự
viết lại chuỗi màu**:

- `STATUS_OUTLINE_CLASS` — badge viền, nền trong suốt (status/expiry badge).
- `STATUS_FILLED_CLASS` — badge nền nhạt, không viền (workflow status badge).
- `STATUS_TILE_CLASS` — ô icon KPI card (viền + nền icon + màu icon).
- `STATUS_TEXT_CLASS` — chỉ màu chữ, không nền/viền (số liệu inline).
- `STATUS_BANNER_CLASS` — banner/callout cả đoạn văn (viền + nền + chữ).

**Ngoại lệ có chủ đích** (không ép vào hệ 4 tông, giữ nguyên):
- Màu phân loại/thương hiệu theo từng KPI (vd. dashboard Sự cố: xanh lá=tổng số,
  xanh dương=chi phí, vàng=số ngày, tím=điểm trừ) — đây là màu category, không phải
  màu rủi ro.
- Trạng thái workflow thông tin thuần túy (vd. "Mới tạo", "Không đổi") dùng xanh dương
  riêng — không phải success/warning/critical.

### Màu biểu đồ (chart color tokens — hoàn thành)

Trước đây mỗi biểu đồ phân bố (department/category/vị trí bị thương...) tự cycle qua
8 sắc độ xanh lá hoặc xanh dương khác nhau theo index — nhìn rối, thiếu đồng nhất, và
không mang ý nghĩa gì (chỉ là màu trang trí). Đã thay bằng **một token màu thương hiệu
HSE duy nhất, dùng chung cho mọi biểu đồ phân bố/không có ý nghĩa rủi ro trên toàn hệ
thống** (Sự cố, Nhân viên, PCCC, và mọi module sau này):

- `--chart-brand` (`src/app/globals.css`) — 1 màu xanh HSE duy nhất (light `#16a34a`,
  dark `#22c55e`, khớp `--success`/`--primary` hiện có). Export dùng chung tại
  `src/components/charts/chart-utils.tsx`: `CHART_BRAND`.
- `chartBrandOpacity(i)` — dãy độ mờ giảm dần theo thứ hạng (1 → 0.82 → 0.68 → ... →
  0.26), **cùng một màu, chỉ khác độ sáng/đậm** — dùng cho donut/pie (các lát cần phân
  biệt nhau); bar chart không cần vì độ dài cột đã thể hiện thứ hạng, nên bar luôn dùng
  `CHART_BRAND` ở độ mờ 100%.
- **Trạng thái chọn/focus** (vd. cột bộ phận đang được click để lọc trong biểu đồ Nhân
  viên): cột đang chọn = `CHART_BRAND` độ mờ 100%; cột còn lại = cùng màu, độ mờ 35% —
  không đổi hue, chỉ đổi độ sáng.

**Đã xoá bỏ hoàn toàn**: `GREEN_SHADES`/`BLUE_SHADES` (8 sắc độ mỗi màu, dùng cho
Department/Category) và `CHART_COLORS`/`colorForIndex` (bảng 5 màu rainbow mặc định
cho donut không có colorMap, vd. "Theo vị trí bị thương"). Không còn palette prop nào
truyền vào `TopNBarChart`.

**Ngoại lệ có chủ đích (giữ nguyên, không đổi)**:
- Donut mức độ nghiêm trọng (severity) vẫn dùng đúng `colorHex` cấu hình theo từng mức
  (A/B/C/D) — đây là màu **ngữ nghĩa rủi ro thật**, không phải màu phân loại, nên không
  được ép về `CHART_BRAND`. `DonutChart`'s `colorMap` prop luôn ưu tiên hơn brand green.
- `TrendLineChart` (xu hướng sự cố = xanh lá, xu hướng chi phí = xanh dương) giữ nguyên
  — mỗi biểu đồ chỉ 1 màu đặc duy nhất (không phải rainbow nhiều màu trong 1 biểu đồ),
  và xanh dương ở đây phân biệt có chủ đích "số liệu vận hành" (an toàn) với "số liệu
  tài chính" (chi phí), không phải trang trí tùy tiện.
- "Khác" (bucket gộp phần còn lại sau topN) luôn dùng `var(--muted-foreground)` — màu
  trung tính thật sự, không thuộc họ màu thương hiệu, không thuộc hệ rủi ro.

**Quy tắc cho biểu đồ mới**: import `CHART_BRAND` (và `chartBrandOpacity` nếu là
donut/pie) từ `src/components/charts/chart-utils.tsx`. Không tự viết mảng màu riêng,
không dùng `--chart-1..5` trực tiếp trừ khi đó thực sự là dữ liệu ngữ nghĩa rủi ro có
`colorMap` riêng (như severity).

## Typography (F3 — hoàn thành)

Không dùng cỡ chữ tùy ý (arbitrary px) cho các vai trò lặp lại nhiều module — dùng đúng
thang chữ dưới đây:

| Vai trò | Class | Cỡ chữ | Ví dụ |
|---|---|---|---|
| Page title (H1) | `text-xl font-semibold` | 20px / 600 | `<h1>` đầu mỗi trang |
| Page subtitle | `text-sm text-muted-foreground` | 14px | Dòng mô tả dưới H1 |
| Card/section title | `<CardTitle className="text-base font-semibold">` | 16px / 600 | Tiêu đề mỗi Card, chart, form section |
| KPI value (số lớn) | `text-2xl font-bold leading-none` | 24px / 700 | Số liệu chính trên KPI card |
| KPI label (caption) | `text-[11px] font-semibold tracking-wide text-muted-foreground uppercase` | 11px / 600, viết hoa | Nhãn phía trên/dưới số KPI |
| Body/table text | `text-sm` (mặc định của `Table`) | 14px | Nội dung bảng, form field |
| Hint/caption | `text-xs text-muted-foreground` | 12px | Ghi chú phụ, mô tả empty-state |

**Ngoại lệ có tài liệu hóa**: KPI value có chuỗi dài (vd. số tiền định dạng đầy đủ) được
phép dùng cỡ nhỏ hơn `text-2xl` để tránh tràn/xuống dòng — không coi đây là lỗi cần sửa,
đây là quy tắc: *ưu tiên không vỡ layout hơn là giữ đúng cỡ chữ tuyệt đối*.

`CardTitle` mặc định (`src/components/ui/card.tsx`) chỉ có `font-medium` — **luôn thêm
`font-semibold` khi dùng làm tiêu đề section**, nếu không sẽ nhẹ hơn phần còn lại của
trang một cách không chủ ý.

### Đã sửa trong F3 (đồng bộ hóa, không đổi cách tính số liệu)
- KPI value: PCCC (22px) và Nhân viên (18px) → 24px (`text-2xl`), khớp với CAPA đã có sẵn.
- CAPA KPI: thêm `font-bold leading-none`, đổi label từ `CardDescription` mặc định sang
  đúng kiểu caption viết hoa dùng chung với PCCC/Sự cố/Nhân viên.
- `department-chart.tsx`: tiêu đề chart 14px→16px, khớp với mọi chart khác (TopNBarChart/DonutChart/TrendLineChart).
- `employee-form.tsx`, `incident-form.tsx`: thêm `font-semibold` còn thiếu ở tiêu đề section form.

**Không đụng vào**: 4 KPI card của dashboard Sự cố (26px cho 3 KPI chính, 20px riêng
cho KPI chi phí để tránh tràn số dài) — đây là dashboard được xem nhiều nhất, cỡ chữ
lớn hơn một bậc là chủ đích (nhấn mạnh), không phải lỗi trôi dạt.

## Spacing

Đã nhất quán từ trước — dùng thang spacing mặc định của Tailwind (bội số 4px), không có
giá trị tùy ý nào được tìm thấy khi audit F3:

| Vai trò | Class | Giá trị |
|---|---|---|
| Khoảng cách giữa các section lớn trong trang | `gap-6` | 24px |
| Khoảng cách nội dung trong Card | `gap-3` / `gap-4` | 12px / 16px |
| Khoảng cách icon + chữ | `gap-1.5` / `gap-2` / `gap-2.5` | 6px / 8px / 10px |
| Padding trang (content area) | `p-4 md:p-6` | 16px / 24px (từ `AppShell`) |
| Padding Card | tự động qua `--card-spacing` | 16px mặc định, 12px khi `size="sm"` |

## Component rules (áp dụng ngay, sẽ mở rộng ở F4–F6)

- **Status/Badge**: luôn import từ `src/lib/status-tone.ts`, không viết lại chuỗi màu.
- **EmptyState**: dùng `src/components/ui/empty-state.tsx` (module đã có dữ liệu) hoặc
  `src/components/module-empty-state.tsx` (module khung sẵn, chưa có dữ liệu).
- **Pagination**: dùng `src/components/ui/table-pagination.tsx`, mặc định 20 dòng/trang.
- **KPI Card**: icon-box `size-8`–`size-9`, bo góc `rounded-md`/`rounded-lg`, dùng
  `STATUS_TILE_CLASS` khi màu mang ý nghĩa rủi ro.
- **Chart**: số liệu phải hiển thị trực tiếp trên chart (label/value visible), không bắt
  hover mới thấy — quy tắc bắt buộc cho mọi chart mới.
- **Sidebar**: nhóm theo domain nghiệp vụ, chỉ hiện tên nhóm mặc định, mở rộng khi hover
  HOẶC focus bàn phím (không được chỉ hỗ trợ hover).

## Form validation (F4 — hoàn thành)

Lỗi validation phải hiển thị ngay dưới field bị lỗi, không chỉ ở banner chung dưới cùng
form — người dùng không được phải đoán field nào sai.

- `src/lib/form-errors.ts` — `zodFieldErrors(error)` chuyển `ZodError` thành
  `Record<tên_field, "required" | "tooLong" | "invalid">`. Dùng issue **code** (không
  phải message tùy chỉnh) nên không cần dịch riêng từng field.
- `src/components/ui/field-error.tsx` — `<FieldError kind={...} />`, hiển thị đúng câu
  dịch (`common.form.required` / `common.form.tooLong` / `common.invalidInput`).
- Input/Select/Textarea đã sẵn `aria-invalid:border-destructive` trong class mặc định —
  chỉ cần truyền `aria-invalid={!!state?.fieldErrors?.tenField}` là tự động có viền đỏ.
- Với validation rule tùy chỉnh (không qua zod, vd. "ghi chú bắt buộc khi độ tin cậy
  là Chưa xác định") — set trực tiếp `fieldErrors: { tenField: "required" }` trong action.

**Quy tắc cho form mới**: nếu form có nhiều hơn ~3 field, PHẢI dùng pattern này thay vì
chỉ trả `{ error: string }` chung chung. Form ngắn (2–3 field, vd. đăng nhập, mời người
dùng) có thể giữ banner chung nếu không có sự mơ hồ thực sự về field nào sai.

## Dialog confirmation (F5 — hoàn thành)

**Không dùng `window.confirm()`** cho bất kỳ hành động phá hủy/không thể hoàn tác nào —
dùng `src/components/ui/confirm-dialog.tsx` (`<ConfirmDialog>`).

2 cách dùng:
- **Uncontrolled** (trigger là nút bấm thường): truyền prop `trigger`.
- **Controlled** (trigger nằm trong overlay khác, vd. `DropdownMenuItem`): truyền
  `open`/`onOpenChange`, không truyền `trigger` — tránh lồng `DialogTrigger` trực tiếp
  trong dropdown vì sẽ xung đột hành vi đóng của dropdown.

```tsx
<ConfirmDialog
  trigger={<Button variant="destructive">Xóa</Button>}
  description={t("...")}
  confirmLabel={t("common.delete")}
  onConfirm={handleConfirm}
  pending={pending}
/>
```

**Quy tắc cho hành động mới**: bất kỳ hành động xóa/không thể hoàn tác nào phải dùng
`ConfirmDialog`, không tự viết `window.confirm()` hay dialog riêng.

## Filter chip — số lượng bộ lọc đang áp dụng (F6 — hoàn thành)

Mọi filter bar (dạng "ô tìm kiếm + vài Select + nút Xóa bộ lọc") phải hiển thị một badge
nhỏ, trung tính, cho biết đang áp dụng bao nhiêu bộ lọc — người dùng dễ quên mình đang lọc
gì khi filter bar có nhiều trường, đặc biệt sau khi điều hướng qua lại nhiều lần.

- `src/lib/count-active-filters.ts` — `countActiveFilters(...values)`: đếm số prop có giá
  trị thật (bỏ qua `undefined`/`""`). Nhận thẳng các prop *đã được chuẩn hóa* của filter bar
  (chỗ `page.tsx` đã convert `"all"` → `undefined` từ trước) — không cần biết field nào ứng
  với Select nào, không đụng vào logic filter/query.
- `src/components/ui/filter-count-badge.tsx` — `<FilterCountBadge count={n} />`: dùng
  `<Badge variant="secondary">` (màu trung tính, không phải success/warning/critical — đây
  là thông tin trạng thái UI, không mang ý nghĩa rủi ro), tự ẩn khi `count === 0` để không
  gây nhiễu lúc chưa lọc gì.
- Đã lắp vào cả 4 filter bar hiện có: `incident-filters.tsx`, `employee-filters.tsx`,
  `capa-filters.tsx`, `records-filters.tsx` — badge đặt ngay trước link "Xóa bộ lọc".

**Không đụng vào**: các tham số "carry" từ dashboard drill-down (vd. `dYear`/`dMonth`/
`dWeek`/`dOrgUnitId` truyền vào Incidents list qua hidden input) không được tính vào số đếm
— đây là ngữ cảnh điều hướng từ dashboard, không phải trường do người dùng thao tác trực
tiếp trên chính filter bar đó.

**Quy tắc cho filter bar mới**: tính `activeCount` bằng `countActiveFilters(...)` trên đúng
các prop hiển thị trên form, đặt `<FilterCountBadge count={activeCount} />` ngay trước nút
"Xóa bộ lọc".

## Chưa hoàn thành

Không còn mục nào trong danh sách Phase 1 (F1–F6) — cả 6 bước đã triển khai và xác minh.
Các hạng mục ngoài phạm vi Phase 1 (chưa quyết định, chờ yêu cầu thêm nếu cần):
- Nút xóa tài liệu/đính kèm trên trang chi tiết sự cố chưa có xác nhận.
- Nút "Xóa vai trò" trong `admin/users/users-table.tsx` chưa có xác nhận.
