# API Key 管理功能 — 实现计划

## 概述

基于 `api.md` 中的 API 规范，实现"登录 + 控制台 + API Key 管理"完整功能。用户登录后进入控制台页面（展示多个圆角矩形功能卡片），点击"API Key 管理"卡片进入 API Key 管理页面。

设计参照现有 SSO 登录流程，**复用 QR 登录 / Passkey 登录组件**，保持一致的 UI 布局、i18n、jotai 状态管理模式。

**UI 全部基于 HeroUI v3 组件布局**（Card, Modal, Avatar, Button, Chip, Input, CheckboxGroup, Separator, EmptyState, Spinner, Tooltip, Popover 等），与现有 `sso-authorize` 页面风格统一。

**核心变更要点（相较于初版计划）：**
1. Scopes 仅支持 3 种权限：`mcp` / `mcp:read` / `mcp:write`（后端实际支持的 `openapi*` 暂不在前端暴露）
2. BFF 层需同步新增 **edge-functions/** 路由（项目实际 BFF 部署在 EdgeOne Edge Functions）
3. 页面右上角提供**夜间模式 / 语言切换**（直接复用 `sso-authorize/HeaderBar`）
4. 登录视图**复用 sso-authorize 的 QRLoginView / PasskeyLoginView**，通过 props 传入不同的 `onLoggedIn` 回调

---

## 1. 页面路由结构

```
app/
  console/                       # 控制台（登录后首页）
    page.tsx                     # Server: metadata
    page.client.tsx              # Client: 控制台主页面
    store.ts                     # Jotai atoms
    ConsoleView.tsx              # 已登录的控制台视图
  console/
    apikeys/                     # API Key 管理子页面
      page.tsx                   # Server: metadata
      page.client.tsx            # Client: API Key 管理主页面
      CreateTokenModal.tsx       # 创建 Token 弹窗
      TokenCard.tsx              # 单个 Token 卡片展示
      RotateTokenModal.tsx       # 轮换 Token 弹窗
      TokenRevealModal.tsx       # 新建/轮换后展示 Token 值的弹窗
      store.ts                   # Jotai atoms

components/                      # 共享组件（从 sso-authorize 抽取）
  HeaderBar.tsx                  # ← 从 app/sso-authorize/HeaderBar.tsx 移入
  PageFrame.tsx                  # ← 从 app/sso-authorize/page.client.tsx 的 PageFrame 抽取
  LoginView.tsx                  # ← 从 app/sso-authorize/LoginView.tsx 抽取通用版
  QRLoginView.tsx                # ← 从 app/sso-authorize/QRLoginView.tsx 抽取通用版
  PasskeyLoginView.tsx           # ← 从 app/sso-authorize/PasskeyLoginView.tsx 抽取通用版

services/
  shared.ts                      # ← 从 services/sso/api.ts 抽取 ApiError + request<T>()
  token/api.ts                   # Token API 客户端，import shared 的 request/ApiError
```

---

## 2. BFF 代理路由

项目有 **两套 BFF 代理**需同步维护：

### 2.1 Next.js Route Handlers（`app/api/`）

现有 BFF 已有 `/api/auth/**` 路由代理到 `/web/auth/**`。API Token 页面需新增以下路由，代理到 `/api/**`：

| BFF 路由 | 后端路径 | 方法 |
|----------|----------|------|
| `app/api/tokens/route.ts` | `/api/tokens` | GET, POST |
| `app/api/tokens/[id]/route.ts` | `/api/tokens/{id}` | DELETE |
| `app/api/tokens/[id]/rotate/route.ts` | `/api/tokens/{id}/rotate` | POST |

每个路由遵循现有模式：
```typescript
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export async function GET(req: Request) { return proxyToBackend(req, '/api/tokens'); }
export async function POST(req: Request) { return proxyToBackend(req, '/api/tokens'); }
export const OPTIONS = handlePreflight;
```

> 现有 `/api/auth/**` 路由已可复用（QR/Passkey/Me/Logout/Refresh），无需修改。

### 2.2 EdgeOne Edge Functions（`edge-functions/`）

实际部署时 BFF 运行在 EdgeOne，需同步新增以下 Edge Function：

| Edge Function 文件 | 对应路径 | 后端路径 | 导出 |
|---------------------|----------|----------|------|
| `edge-functions/api/tokens/index.ts` | `/api/tokens` | `/api/tokens` | `onRequestGet`, `onRequestPost`, `onRequestOptions` |
| `edge-functions/api/tokens/[id].ts` | `/api/tokens/:id` | `/api/tokens/:id` | `onRequestDelete`, `onRequestOptions` |
| `edge-functions/api/tokens/[id]/rotate.ts` | `/api/tokens/:id/rotate` | `/api/tokens/:id/rotate` | `onRequestPost`, `onRequestOptions` |

每个 Edge Function 遵循现有模式（参照 `edge-functions/api/auth/me.ts`）：
```typescript
import { handlePreflight, proxyToBackend } from '../../_proxy';  // 路径按层级调整

export async function onRequestGet(context: {
  request: Request;
  env: Record<string, string>;
}): Promise<Response> {
  return proxyToBackend(context.request, '/api/tokens', context.env);
}

export async function onRequestPost(context: {
  request: Request;
  env: Record<string, string>;
}): Promise<Response> {
  return proxyToBackend(context.request, '/api/tokens', context.env);
}

export const onRequestOptions = handlePreflight;
```

**注意：** `/api/tokens/:id` 和 `/api/tokens/:id/rotate` 需要从 `context.params` 取动态路径参数：
```typescript
// edge-functions/api/tokens/[id].ts
export async function onRequestDelete(context: {
  request: Request;
  env: Record<string, string>;
  params: Record<string, string>;
}): Promise<Response> {
  const id = encodeURIComponent(context.params.id ?? '');
  return proxyToBackend(context.request, `/api/tokens/${id}`, context.env);
}
```

> `/api/auth/**` 的 Edge Functions 已存在，无需修改。

---

## 3. Service 层

### 3.1 抽取 `services/shared.ts`

从 `services/sso/api.ts` 中抽取 `ApiError` 类和 `request<T>()` 函数到共享模块，`sso/api.ts` 和 `token/api.ts` 均从此处 import。

```typescript
// services/shared.ts
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  constructor(status: number, body?: ApiErrorBody) {
    super(body?.message ?? `request failed: ${status}`);
    this.status = status;
    this.code = body?.code ?? String(status);
  }
}

export interface ApiErrorBody {
  code: string;
  message?: string;
}

export const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE ?? ''}/api`;

function getAcceptLanguage(): string | undefined { /* ...同现有实现... */ }

export async function request<T>(path: string, init?: RequestInit): Promise<T> { /* ...同现有实现... */ }
```

同时修改 `services/sso/api.ts`：删除 `ApiError`、`ApiErrorBody`、`API_BASE`、`request<T>` 的定义，改为从 `services/shared.ts` import。

### 3.2 新建 `services/token/api.ts`

直接使用共享的 `request<T>()` 和 `ApiError`。

```typescript
import { request, ApiError } from '@/services/shared';

// 类型定义
/** 有效的 scope 枚举 */
export const VALID_SCOPES = ['mcp', 'mcp:read', 'mcp:write'] as const;
export type ValidScope = (typeof VALID_SCOPES)[number];

interface CreateTokenRequest {
  name: string;
  scopes: ValidScope[];
  ttl_days: number;
}

interface CreateTokenResponse {
  id: string;
  name: string;
  token: string;       // 仅创建/轮换时返回一次
  scopes: string[];
  expires_at: string;
  created_at: string;
}

interface TokenListItem {
  id: string;
  name: string;
  last4: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string;
  created_at: string;
}

interface ListTokensResponse {
  tokens: TokenListItem[];
}

interface RotateTokenRequest {
  ttl_days: number;
}

// API 对象
export const TokenApi = {
  list:   () => request<ListTokensResponse>('/tokens'),
  create: (body: CreateTokenRequest) => request<CreateTokenResponse>('/tokens', { method: 'POST', body: JSON.stringify(body) }),
  rotate: (id: string, body: RotateTokenRequest) => request<CreateTokenResponse>(`/tokens/${encodeURIComponent(id)}/rotate`, { method: 'POST', body: JSON.stringify(body) }),
  revoke: (id: string) => request<void>(`/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
```

---

## 4. Jotai Store 设计

### 4.1 `app/console/store.ts` — 控制台状态

```typescript
import { atom } from 'jotai';
import { MeResponse } from '@/services/sso/api';

export type ConsoleStage =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'console'; me: MeResponse };

/** 当前页面阶段 */
export const consoleStageAtom = atom<ConsoleStage>({ kind: 'loading' });

/** 当前用户信息（登录后可用） */
export const userAtom = atom<MeResponse | null>(null);
```

### 4.2 `app/console/apikeys/store.ts` — API Key 管理状态

```typescript
import { atom } from 'jotai';
import { TokenListItem, CreateTokenResponse } from '@/services/token/api';

/** Token 列表 */
export const tokenListAtom = atom<TokenListItem[]>([]);

/** 列表加载中 */
export const tokenListLoadingAtom = atom<boolean>(true);

/** 新创建 / 轮换后的 Token（仅显示一次） */
export const newlyCreatedTokenAtom = atom<CreateTokenResponse | null>(null);

/** 创建弹窗可见 */
export const createModalVisibleAtom = atom<boolean>(false);

/** 轮换弹窗可见 + 目标 token id */
export const rotateModalAtom = atom<{ visible: boolean; tokenId: string | null }>({
  visible: false,
  tokenId: null,
});
```

---

## 5. 页面详细设计（基于 HeroUI v3 组件）

### 5.0 共享组件抽取

在实现具体页面前，先将 sso-authorize 中可复用的组件抽取到 `components/`：

#### 5.0.1 `components/HeaderBar.tsx`（从 `app/sso-authorize/HeaderBar.tsx` 移入）

当前 HeaderBar 位于 `app/sso-authorize/` 下，但它本身不依赖 sso 的任何 store，只是组合了 `ThemeSwitcher` + `LanguageSwitcher`，天然通用。移到 `components/` 后：

- `app/sso-authorize/page.client.tsx` 改为 `import HeaderBar from '@/components/HeaderBar'`
- console / apikeys 页面同样 `import HeaderBar from '@/components/HeaderBar'`

#### 5.0.2 `components/PageFrame.tsx`（从 `app/sso-authorize/page.client.tsx` 的 PageFrame 抽取）

sso-authorize 中的 `PageFrame` 组件提供"全屏居中 + HeaderBar + 圆角 Card"布局，console 和 apikeys 页面完全相同。

```tsx
// components/PageFrame.tsx
import HeaderBar from '@/components/HeaderBar';

interface PageFrameProps {
  children: React.ReactNode;
  /** Card 最大宽度，默认 'max-w-md'（sso 登录用） */
  maxWidth?: string;
}

const PageFrame = ({ children, maxWidth = 'max-w-md' }: PageFrameProps) => (
  <div className="min-h-screen w-full overflow-x-hidden flex flex-col items-center justify-center bg-default px-1 sm:px-2 md:px-4 py-20">
    <HeaderBar />
    <div className={`bg-surface rounded-[16px] p-6 md:p-10 w-full ${maxWidth} flex flex-col items-stretch gap-6`}>
      {children}
    </div>
  </div>
);

export default PageFrame;
```

- sso-authorize: `<PageFrame>` (默认 `max-w-md`)
- console: `<PageFrame maxWidth="max-w-2xl">`
- apikeys: `<PageFrame maxWidth="max-w-2xl">`

#### 5.0.3 `components/QRLoginView.tsx`（从 `app/sso-authorize/QRLoginView.tsx` 抽取通用版）

将原有 QRLoginView 中硬编码的 `stageAtom` 写入替换为 `onLoggedIn` 回调 prop：

```tsx
// components/QRLoginView.tsx
interface QRLoginViewProps {
  onLoggedIn: (me: MeResponse) => void;
}
```

内部逻辑不变，仅将 `setStage({ kind: 'consent', me })` → `onLoggedIn(me)`。

#### 5.0.4 `components/PasskeyLoginView.tsx`（从 `app/sso-authorize/PasskeyLoginView.tsx` 抽取通用版）

同理，接受 `onLoggedIn` 回调：

```tsx
// components/PasskeyLoginView.tsx
interface PasskeyLoginViewProps {
  onLoggedIn: (me: MeResponse) => void;
}
```

#### 5.0.5 `components/LoginView.tsx`（从 `app/sso-authorize/LoginView.tsx` 抽取通用版）

sso-authorize 和 console 的登录布局完全相同（logo + 标题 + QR + separator + passkey），仅 i18n namespace 不同。

```tsx
// components/LoginView.tsx
import QRLoginView from '@/components/QRLoginView';
import PasskeyLoginView from '@/components/PasskeyLoginView';

interface LoginViewProps {
  onLoggedIn: (me: MeResponse) => void;
  /** i18n namespace，用于标题/副标题等文案，默认 'sso' */
  namespace?: string;
}
```

通用 LoginView 内部用 `useTranslations(namespace)` 读取标题/副标题文案，QRLoginView 和 PasskeyLoginView 各自仍用 `sso.qr` / `sso.passkey` namespace（登录相关文案不需要区分场景）。

> 如果 console 登录页标题与 sso 不同，可在外层自定义 header slot，或通过 namespace 传入不同的 i18n key。

#### 5.0.6 SSO wrapper 改造

`app/sso-authorize/` 下被抽取的 4 个文件改为 thin wrapper 或直接删除：

| 原文件 | 改造方式 |
|--------|----------|
| `QRLoginView.tsx` | 删除文件，page.client.tsx 改为 `import QRLoginView from '@/components/QRLoginView'` 并传入 `onLoggedIn` |
| `PasskeyLoginView.tsx` | 同上 |
| `LoginView.tsx` | 删除文件，page.client.tsx 改为 `import LoginView from '@/components/LoginView'` |
| `HeaderBar.tsx` | 删除文件，改为 `import HeaderBar from '@/components/HeaderBar'` |

`sso-authorize/page.client.tsx` 中将 `PageFrame` 替换为 `import PageFrame from '@/components/PageFrame'`。

---

### 5.1 控制台页面 `/console`

**流程：**
1. 客户端挂载后调用 `WebAuthApi.me()` 检测登录态
2. 401 → 设置 `consoleStage = { kind: 'login' }`，显示登录界面
3. 已登录 → 设置 `consoleStage = { kind: 'console', me }`，显示控制台

**HeroUI 布局结构：**

```
<PageFrame maxWidth="max-w-2xl">
  <!-- 登录态：控制台视图 -->
  <ConsoleView />

  <!-- 未登录：复用通用 LoginView -->
  <LoginView onLoggedIn={(me) => setStage({ kind: 'console', me })} namespace="console" />
</PageFrame>
```

### 5.2 控制台视图 `ConsoleView.tsx`（已登录状态）

```
<Card variant="surface" className="w-full max-w-2xl rounded-[16px] p-6 md:p-10">
  <Card.Header>
    <Avatar> + 问候语 + 昵称 + 退出按钮
  </Card.Header>
  <Card.Content>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- 功能卡片 -->
      <Card variant="default" className="rounded-[12px] cursor-pointer hover:..."> 
        <Card.Content className="flex flex-col items-center gap-3 py-6">
          <span material-icons-round !text-[48px]>key</span>
          <Card.Title>API Key 管理</Card.Title>
          <Card.Description>创建与管理你的 API 密钥</Card.Description>
        </Card.Content>
      </Card>
    </div>
  </Card.Content>
</Card>
```

**功能卡片（HeroUI Card compound pattern）：**
- 外层：`<Card variant="default">` — 圆角矩形，默认填充背景
- 内部结构使用 `<Card.Content>` + `<Card.Title>` + `<Card.Description>`
- 大 icon：Material Design icon `key`，48px
- 标题：`<Card.Title>` "API Key 管理"
- 副标题：`<Card.Description>` "创建与管理你的 API 密钥"
- 可点击：整个 Card 包裹 `<Link>` 或用 `onClick` + `cursor-pointer`
- 网格：CSS Grid，响应式 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

**用户信息区（Card.Header 内）：**
- `<Avatar>` 显示用户头像（复用 sso ConsentView 的 Avatar 用法）
- 问候语（基于时段）
- 退出按钮：`<Button variant="tertiary">` + `logout` icon

### 5.3 登录视图（复用通用 `components/LoginView`）

当 `consoleStage.kind === 'login'` 时，直接使用 `components/LoginView`：

```tsx
import LoginView from '@/components/LoginView';

<LoginView
  onLoggedIn={(me) => setStage({ kind: 'console', me })}
  namespace="console"
/>
```

通用 LoginView 已包含完整布局：Logo + 标题 + QRLoginView + Separator + PasskeyLoginView。无需在 console 目录下新建 LoginView 文件。

### 5.4 夜间模式 / 语言切换

**已内置于 `components/PageFrame`**（通过 `components/HeaderBar`）。

HeaderBar 包含：
- `<ThemeSwitcher />` — 三态切换（auto / light / dark），写入 `NEXT_THEME` cookie
- `<LanguageSwitcher />` — 多语言切换（auto / zh / en / ja），写入 `NEXT_LOCALE` cookie

所有使用 `<PageFrame>` 的页面自动获得右上角的夜间模式 / 语言切换功能。

---

### 5.5 API Key 管理页面 `/console/apikeys`

**HeroUI 布局结构：**

```
<PageFrame maxWidth="max-w-2xl">
  <Card.Header className="flex flex-row items-center justify-between">
    <div className="flex items-center gap-3">
      <Button variant="tertiary" onPress={() => router.push('/console')}>
        <span material-icons-round>arrow_back</span>
      </Button>
      <Card.Title>API Keys</Card.Title>
    </div>
    <Button variant="primary" onPress={() => setCreateModalVisible(true)}>
      <span material-icons-round>add</span>
      创建 Key
    </Button>
  </Card.Header>

  <Card.Content>
    <!-- 加载中 -->
    <Spinner />

    <!-- 空状态 -->
    <EmptyState>
      <EmptyState.Icon>vpn_key</EmptyState.Icon>
      <EmptyState.Title>暂无 API Key</EmptyState.Title>
      <EmptyState.Description>点击上方按钮创建</EmptyState.Description>
    </EmptyState>

    <!-- Token 列表 -->
    {tokens.map(token => <TokenCard key={token.id} token={token} />)}
  </Card.Content>

  <!-- 弹窗们 -->
  <CreateTokenModal />
  <RotateTokenModal />
  <TokenRevealModal />
</PageFrame>
```

**Token 卡片 `TokenCard`（HeroUI Card compound）：**

```jsx
<Card variant="default" className="rounded-[12px]">
  <Card.Header className="flex items-center justify-between">
    <div>
      <Card.Title>{token.name}</Card.Title>
      <Card.Description>••••{token.last4}</Card.Description>
    </div>
    <div className="flex items-center gap-1">
      <Tooltip content={t('card.rotate')}>
        <Button variant="tertiary" size="sm" onPress={onRotate}>
          <span material-icons-round>autorenew</span>
        </Button>
      </Tooltip>
      <Tooltip content={t('card.revoke')}>
        <Button variant="tertiary" size="sm" color="danger" onPress={onRevoke}>
          <span material-icons-round>delete_outline</span>
        </Button>
      </Tooltip>
    </div>
  </Card.Header>
  <Card.Content>
    <!-- Scopes 用 Chip 展示 -->
    <div className="flex flex-wrap gap-1">
      {token.scopes.map(scope => (
        <Chip key={scope} size="sm" variant="outline">{scope}</Chip>
      ))}
    </div>
    <!-- 时间信息 -->
    <div className="text-xs text-muted mt-2">
      创建于 {createdAt} · 过期于 {expiresAt}
      {token.last_used_at ? ` · 最后使用 ${lastUsedAt}` : ' · 从未使用'}
    </div>
  </Card.Content>
</Card>
```

**创建 Token 弹窗 `CreateTokenModal`（HeroUI Modal compound）：**

Scopes 仅 3 种：`mcp` / `mcp:read` / `mcp:write`

```jsx
<Modal>
  <Modal.Backdrop />
  <Modal.Container>
    <Modal.Dialog>
      <Modal.Header>
        <Modal.Heading>创建 API Key</Modal.Heading>
        <Modal.CloseTrigger />
      </Modal.Header>
      <Modal.Body>
        <Input label="名称" placeholder="例如：Cursor IDE" />
        <CheckboxGroup label="权限范围">
          <Checkbox value="mcp">
            <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
            <Checkbox.Content>
              <span>mcp</span>
              <span className="text-xs text-muted">完整 MCP 权限（读取 + 写入）</span>
            </Checkbox.Content>
          </Checkbox>
          <Checkbox value="mcp:read">
            <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
            <Checkbox.Content>
              <span>mcp:read</span>
              <span className="text-xs text-muted">仅 MCP 读取权限</span>
            </Checkbox.Content>
          </Checkbox>
          <Checkbox value="mcp:write">
            <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
            <Checkbox.Content>
              <span>mcp:write</span>
              <span className="text-xs text-muted">仅 MCP 写入权限</span>
            </Checkbox.Content>
          </Checkbox>
        </CheckboxGroup>
        <Slider label="有效期（天）" minValue={1} maxValue={30} />
      </Modal.Body>
      <Modal.Footer>
        <Modal.CloseTrigger>
          <Button variant="tertiary">取消</Button>
        </Modal.CloseTrigger>
        <Button variant="primary" isPending={submitting}>创建</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal.Container>
</Modal>
```

**Token 展示弹窗 `TokenRevealModal`（HeroUI Modal compound）：**

```jsx
<Modal>
  <Modal.Backdrop />
  <Modal.Container>
    <Modal.Dialog>
      <Modal.Header>
        <Modal.Icon>
          <span material-icons-round>vpn_key</span>
        </Modal.Icon>
        <Modal.Heading>你的 API Key</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <!-- Alert 警告 -->
        <Alert variant="warning">
          请立即复制，此 Key 不会再显示。
        </Alert>
        <!-- Token 值展示 -->
        <div className="bg-default rounded-[8px] p-3 font-mono text-sm break-all">
          {token.token}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onPress={handleCopy}>
          {copied ? '已复制' : '复制'}
        </Button>
        <Modal.CloseTrigger>
          <Button variant="tertiary">关闭</Button>
        </Modal.CloseTrigger>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal.Container>
</Modal>
```

**轮换 Token 弹窗 `RotateTokenModal`（HeroUI Modal compound）：**

```jsx
<Modal>
  <Modal.Backdrop />
  <Modal.Container>
    <Modal.Dialog>
      <Modal.Header>
        <Modal.Heading>轮换 API Key</Modal.Heading>
        <Modal.CloseTrigger />
      </Modal.Header>
      <Modal.Body>
        <Alert variant="danger">旧 Key 将立即失效！</Alert>
        <Slider label="新有效期（天）" minValue={1} maxValue={30} defaultValue={30} />
      </Modal.Body>
      <Modal.Footer>
        <Modal.CloseTrigger>
          <Button variant="tertiary">取消</Button>
        </Modal.CloseTrigger>
        <Button variant="primary" isPending={submitting}>轮换</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal.Container>
</Modal>
```

**撤销确认（HeroUI Popover）：**

使用 `<Popover>` 包裹撤销按钮，内含确认文案 + 确认/取消按钮：
```jsx
<Popover>
  <Popover.Trigger>
    <Button variant="tertiary" size="sm" color="danger">撤销</Button>
  </Popover.Trigger>
  <Popover.Content>
    <p>确定要撤销此 Key 吗？此操作不可撤销。</p>
    <div className="flex gap-2">
      <Button variant="tertiary" size="sm">取消</Button>
      <Button variant="primary" size="sm" color="danger" onPress={onRevoke}>确认</Button>
    </div>
  </Popover.Content>
</Popover>
```

---

## 6. HeroUI v3 组件使用清单

| 组件 | 使用场景 | Compound API |
|------|----------|--------------|
| `Card` | 控制台功能卡片、Token 卡片、页面外框 | `Card.Root/Header/Title/Description/Content/Footer` |
| `Modal` | 创建/轮换/展示 Token 弹窗 | `Modal.Root/Backdrop/Container/Dialog/Header/Heading/Icon/Body/Footer/CloseTrigger` |
| `Button` | 所有操作按钮 | `variant="primary/tertiary"`, `isPending`, `color` |
| `Avatar` | 用户头像展示 | `Avatar/Avatar.Image/Avatar.Fallback` |
| `Chip` | Token Scopes 标签 | `size="sm"`, `variant="outline"` |
| `Input` | 创建弹窗的名称输入 | `label`, `placeholder` |
| `CheckboxGroup` + `Checkbox` | 创建弹窗的权限多选 | `CheckboxGroup/Checkbox.Control/Checkbox.Indicator/Checkbox.Content` |
| `Slider` | 创建/轮换弹窗的有效期选择 | `minValue`, `maxValue`, `defaultValue` |
| `Separator` | 登录页 QR / Passkey 分割线 | 同 sso-authorize LoginView |
| `Spinner` | 加载状态 | `size="lg"` |
| `Tooltip` | Token 卡片操作按钮提示 | `content` |
| `Popover` | 撤销确认弹层 | `Popover.Trigger/Popover.Content` |
| `Alert` | Token 展示弹窗的警告提示 | `variant="warning/danger"` |
| `EmptyState` | Token 列表为空时展示 | `EmptyState.Icon/Title/Description` |
| `Link` | 退出登录 / 返回链接 | 同 ConsentView |
| `Dropdown` | ThemeSwitcher / LanguageSwitcher | 同现有组件 |

---

## 7. i18n 国际化

在 `messages/` 的三个语言文件中新增 `console` 和 `apikey` 命名空间。

### Scopes 描述 i18n

3 种 scope 各有描述文案：

| Scope | zh | en | ja |
|-------|-----|-----|-----|
| `mcp` | 完整 MCP 权限（读取 + 写入） | Full MCP access (read + write) | MCP フルアクセス（読み取り + 書き込み） |
| `mcp:read` | 仅 MCP 读取权限 | MCP read-only access | MCP 読み取り専用 |
| `mcp:write` | 仅 MCP 写入权限 | MCP write-only access | MCP 書き込み専用 |

### `zh.json` 新增

```json
{
  "console": {
    "meta": {
      "title": "控制台 | Ham"
    },
    "greeting": {
      "lateNight": "还不睡吗",
      "dawn": "清晨好",
      "morning": "早上好",
      "noon": "中午好",
      "afternoon": "下午好",
      "evening": "晚上好",
      "default": "你好"
    },
    "logout": "退出登录",
    "card": {
      "apikey": {
        "title": "API Key 管理",
        "subtitle": "创建与管理你的 API 密钥"
      }
    }
  },
  "apikey": {
    "meta": {
      "title": "API Key 管理 | Ham"
    },
    "title": "API Keys",
    "backToConsole": "返回控制台",
    "create": "创建 Key",
    "empty": {
      "title": "暂无 API Key",
      "description": "点击上方按钮创建"
    },
    "scope": {
      "mcp": "完整 MCP 权限（读取 + 写入）",
      "mcp:read": "仅 MCP 读取权限",
      "mcp:write": "仅 MCP 写入权限"
    },
    "card": {
      "last4": "末4位：{last4}",
      "scopes": "权限",
      "createdAt": "创建于",
      "expiresAt": "过期于",
      "lastUsedAt": "最后使用",
      "neverUsed": "从未使用",
      "rotate": "轮换",
      "revoke": "撤销",
      "revokeConfirm": "确定要撤销此 Key 吗？此操作不可撤销。"
    },
    "createModal": {
      "title": "创建 API Key",
      "name": "名称",
      "namePlaceholder": "例如：Cursor IDE",
      "scopes": "权限范围",
      "ttl": "有效期（天）",
      "submit": "创建",
      "success": "API Key 创建成功"
    },
    "rotateModal": {
      "title": "轮换 API Key",
      "warning": "旧 Key 将立即失效！",
      "ttl": "新有效期（天）",
      "submit": "轮换",
      "success": "API Key 轮换成功"
    },
    "tokenReveal": {
      "title": "你的 API Key",
      "warning": "请立即复制，此 Key 不会再显示。",
      "copy": "复制",
      "copied": "已复制",
      "close": "关闭"
    },
    "validation": {
      "nameRequired": "名称不能为空",
      "nameTooLong": "名称不能超过128个字符",
      "scopesRequired": "请至少选择一个权限",
      "ttlRange": "有效期需在1-30天之间",
      "tokenLimit": "已达到最大数量（5个）"
    },
    "error": {
      "fetchFailed": "获取 API Key 列表失败",
      "createFailed": "创建失败",
      "rotateFailed": "轮换失败",
      "revokeFailed": "撤销失败"
    }
  }
}
```

### `en.json` 新增

```json
{
  "console": {
    "meta": { "title": "Console | Ham" },
    "greeting": {
      "lateNight": "Still up?",
      "dawn": "Good dawn",
      "morning": "Good morning",
      "noon": "Good noon",
      "afternoon": "Good afternoon",
      "evening": "Good evening",
      "default": "Hello"
    },
    "logout": "Sign out",
    "card": {
      "apikey": {
        "title": "API Key Management",
        "subtitle": "Create and manage your API keys"
      }
    }
  },
  "apikey": {
    "meta": { "title": "API Key Management | Ham" },
    "title": "API Keys",
    "backToConsole": "Back to Console",
    "create": "Create Key",
    "empty": {
      "title": "No API Keys yet",
      "description": "Click the button above to create one"
    },
    "scope": {
      "mcp": "Full MCP access (read + write)",
      "mcp:read": "MCP read-only access",
      "mcp:write": "MCP write-only access"
    },
    "card": {
      "last4": "Last 4: {last4}",
      "scopes": "Scopes",
      "createdAt": "Created",
      "expiresAt": "Expires",
      "lastUsedAt": "Last used",
      "neverUsed": "Never used",
      "rotate": "Rotate",
      "revoke": "Revoke",
      "revokeConfirm": "Are you sure you want to revoke this key? This action cannot be undone."
    },
    "createModal": {
      "title": "Create API Key",
      "name": "Name",
      "namePlaceholder": "e.g. Cursor IDE",
      "scopes": "Scopes",
      "ttl": "TTL (days)",
      "submit": "Create",
      "success": "API Key created successfully"
    },
    "rotateModal": {
      "title": "Rotate API Key",
      "warning": "The old key will be immediately revoked!",
      "ttl": "New TTL (days)",
      "submit": "Rotate",
      "success": "API Key rotated successfully"
    },
    "tokenReveal": {
      "title": "Your API Key",
      "warning": "Copy this key now. It will not be shown again.",
      "copy": "Copy",
      "copied": "Copied",
      "close": "Close"
    },
    "validation": {
      "nameRequired": "Name is required",
      "nameTooLong": "Name must be 128 characters or less",
      "scopesRequired": "At least one scope is required",
      "ttlRange": "TTL must be between 1 and 30 days",
      "tokenLimit": "Maximum token limit reached (5)"
    },
    "error": {
      "fetchFailed": "Failed to fetch API keys",
      "createFailed": "Failed to create",
      "rotateFailed": "Failed to rotate",
      "revokeFailed": "Failed to revoke"
    }
  }
}
```

### `ja.json` 新增

```json
{
  "console": {
    "meta": { "title": "コンソール | Ham" },
    "greeting": {
      "lateNight": "まだ起きてますか？",
      "dawn": "おはようございます",
      "morning": "おはようございます",
      "noon": "こんにちは",
      "afternoon": "こんにちは",
      "evening": "こんばんは",
      "default": "こんにちは"
    },
    "logout": "ログアウト",
    "card": {
      "apikey": {
        "title": "API Key 管理",
        "subtitle": "API キーの作成と管理"
      }
    }
  },
  "apikey": {
    "meta": { "title": "API Key 管理 | Ham" },
    "title": "API Keys",
    "backToConsole": "コンソールに戻る",
    "create": "キーを作成",
    "empty": {
      "title": "API Key がありません",
      "description": "上のボタンをクリックして作成"
    },
    "scope": {
      "mcp": "MCP フルアクセス（読み取り + 書き込み）",
      "mcp:read": "MCP 読み取り専用",
      "mcp:write": "MCP 書き込み専用"
    },
    "card": {
      "last4": "末4桁：{last4}",
      "scopes": "権限",
      "createdAt": "作成日",
      "expiresAt": "有効期限",
      "lastUsedAt": "最終使用",
      "neverUsed": "未使用",
      "rotate": "ローテート",
      "revoke": "取り消し",
      "revokeConfirm": "このキーを取り消しますか？この操作は取り消せません。"
    },
    "createModal": {
      "title": "API Key を作成",
      "name": "名前",
      "namePlaceholder": "例：Cursor IDE",
      "scopes": "権限スコープ",
      "ttl": "有効期間（日）",
      "submit": "作成",
      "success": "API Key が作成されました"
    },
    "rotateModal": {
      "title": "API Key をローテート",
      "warning": "古いキーは即座に無効になります！",
      "ttl": "新しい有効期間（日）",
      "submit": "ローテート",
      "success": "API Key がローテートされました"
    },
    "tokenReveal": {
      "title": "あなたの API Key",
      "warning": "今すぐコピーしてください。再度表示されることはありません。",
      "copy": "コピー",
      "copied": "コピーしました",
      "close": "閉じる"
    },
    "validation": {
      "nameRequired": "名前は必須です",
      "nameTooLong": "名前は128文字以内で入力してください",
      "scopesRequired": "少なくとも1つの権限を選択してください",
      "ttlRange": "有効期間は1〜30日の範囲で指定してください",
      "tokenLimit": "最大トークン数に達しました（5個）"
    },
    "error": {
      "fetchFailed": "API Key の取得に失敗しました",
      "createFailed": "作成に失敗しました",
      "rotateFailed": "ローテートに失敗しました",
      "revokeFailed": "取り消しに失敗しました"
    }
  }
}
```

---

## 8. 文件变更清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `services/shared.ts` | 共享 HTTP 层：`ApiError`、`request<T>()`、`API_BASE`（从 `services/sso/api.ts` 抽取） |
| `services/token/api.ts` | Token API 客户端，import shared 的 `request` / `ApiError` |
| `components/HeaderBar.tsx` | 通用 HeaderBar（含 ThemeSwitcher + LanguageSwitcher），从 `app/sso-authorize/HeaderBar.tsx` 移入 |
| `components/PageFrame.tsx` | 通用页面框架（全屏居中 + HeaderBar + 圆角 Card），从 `app/sso-authorize/page.client.tsx` 的 PageFrame 抽取 |
| `components/LoginView.tsx` | 通用登录视图（Logo + 标题 + QR + Separator + Passkey），从 `app/sso-authorize/LoginView.tsx` 抽取，接受 `onLoggedIn` + `namespace` props |
| `components/QRLoginView.tsx` | 通用 QR 登录视图，从 `app/sso-authorize/QRLoginView.tsx` 抽取，接受 `onLoggedIn` prop |
| `components/PasskeyLoginView.tsx` | 通用 Passkey 登录视图，从 `app/sso-authorize/PasskeyLoginView.tsx` 抽取，接受 `onLoggedIn` prop |
| `app/console/page.tsx` | Server: metadata |
| `app/console/page.client.tsx` | Client: 控制台主页面（stage 判断 + PageFrame + ConsoleView / LoginView） |
| `app/console/store.ts` | Jotai atoms（consoleStageAtom, userAtom） |
| `app/console/ConsoleView.tsx` | 已登录控制台视图（Avatar + 功能卡片网格） |
| `app/console/apikeys/page.tsx` | Server: metadata |
| `app/console/apikeys/page.client.tsx` | Client: API Key 管理主页面（PageFrame + HeroUI Card + EmptyState + 列表） |
| `app/console/apikeys/store.ts` | Jotai atoms（tokenListAtom, createModalVisibleAtom 等） |
| `app/console/apikeys/CreateTokenModal.tsx` | 创建 Token 弹窗（HeroUI Modal + Input + CheckboxGroup + Slider，3 种 scope） |
| `app/console/apikeys/TokenCard.tsx` | 单个 Token 卡片（HeroUI Card + Chip + Tooltip + Popover） |
| `app/console/apikeys/RotateTokenModal.tsx` | 轮换 Token 弹窗（HeroUI Modal + Alert + Slider） |
| `app/console/apikeys/TokenRevealModal.tsx` | Token 值展示弹窗（HeroUI Modal + Alert + 复制按钮） |
| `app/api/tokens/route.ts` | Next.js BFF: GET + POST /api/tokens |
| `app/api/tokens/[id]/route.ts` | Next.js BFF: DELETE /api/tokens/:id |
| `app/api/tokens/[id]/rotate/route.ts` | Next.js BFF: POST /api/tokens/:id/rotate |
| `edge-functions/api/tokens/index.ts` | EdgeOne BFF: GET + POST /api/tokens |
| `edge-functions/api/tokens/[id].ts` | EdgeOne BFF: DELETE /api/tokens/:id |
| `edge-functions/api/tokens/[id]/rotate.ts` | EdgeOne BFF: POST /api/tokens/:id/rotate |

### 修改文件

| 文件 | 变更 |
|------|------|
| `services/sso/api.ts` | 删除 `ApiError`、`ApiErrorBody`、`API_BASE`、`request<T>` 的定义，改为从 `services/shared.ts` import |
| `app/sso-authorize/HeaderBar.tsx` | 删除文件，改为 `import HeaderBar from '@/components/HeaderBar'` |
| `app/sso-authorize/LoginView.tsx` | 删除文件，改为 `import LoginView from '@/components/LoginView'` |
| `app/sso-authorize/QRLoginView.tsx` | 删除文件，改为 `import QRLoginView from '@/components/QRLoginView'` |
| `app/sso-authorize/PasskeyLoginView.tsx` | 删除文件，改为 `import PasskeyLoginView from '@/components/PasskeyLoginView'` |
| `app/sso-authorize/page.client.tsx` | 删除内联 `PageFrame` 组件，改为 `import PageFrame from '@/components/PageFrame'`；LoginView / HeaderBar import 路径改为 `@/components/`；向 QRLoginView / PasskeyLoginView 传入 `onLoggedIn` 回调 |
| `messages/zh.json` | 新增 `console`、`apikey` 命名空间 |
| `messages/en.json` | 新增 `console`、`apikey` 命名空间 |
| `messages/ja.json` | 新增 `console`、`apikey` 命名空间 |

---

## 9. 组件依赖与复用

| 需求 | 复用来源 | 说明 |
|------|-----------|------|
| HTTP 请求封装 | `services/shared.ts`（从 sso/api.ts 抽取） | `request<T>()` + `ApiError` + `API_BASE`，sso 和 token 共用 |
| HeaderBar（暗黑 + 语言切换） | `components/HeaderBar.tsx`（从 sso-authorize 移入） | PageFrame 内置，所有页面自动获得 |
| PageFrame（页面框架） | `components/PageFrame.tsx`（从 sso page.client.tsx 抽取） | 全屏居中 + HeaderBar + Card，sso/console/apikeys 共用 |
| LoginView（登录布局） | `components/LoginView.tsx`（从 sso-authorize 抽取） | Logo + QR + Separator + Passkey，接受 `onLoggedIn` + `namespace` |
| QRLoginView | `components/QRLoginView.tsx`（从 sso-authorize 抽取） | 接受 `onLoggedIn` 回调，sso/console 共用 |
| PasskeyLoginView | `components/PasskeyLoginView.tsx`（从 sso-authorize 抽取） | 接受 `onLoggedIn` 回调，sso/console 共用 |
| ThemeSwitcher | `components/ThemeSwitcher.tsx` | HeaderBar 已内置，无需单独 import |
| LanguageSwitcher | `components/LanguageSwitcher.tsx` | HeaderBar 已内置，无需单独 import |
| themeAtom / localeAtom | `store/themeAtom.ts`, `store/localeAtom.ts` | 直接 import 使用 |
| Avatar 用法 | `app/sso-authorize/ConsentView.tsx` | Avatar + Avatar.Image + Avatar.Fallback |
| CheckboxGroup | HeroUI v3 | 同 ConsentView 的 compound pattern |
| Modal 用法 | HeroUI v3 Modal | `Modal.Root/Backdrop/Container/Dialog/Header/Heading/Body/Footer/CloseTrigger` |
| Card 用法 | HeroUI v3 Card | `Card.Root/Header/Title/Description/Content/Footer` |
| Jotai 模式 | `app/sso-authorize/store.ts` | 同样使用 atom + stage 模式 |
| Edge Function 模式 | `edge-functions/api/auth/me.ts` 等 | 同样 `proxyToBackend` + `handlePreflight` |

---

## 10. 实现顺序

1. **Service 层共享抽取**：从 `services/sso/api.ts` 抽取 `services/shared.ts`（`ApiError` + `request<T>()` + `API_BASE`），修改 sso/api.ts 改为 import
2. **组件共享抽取**：
   - `app/sso-authorize/HeaderBar.tsx` → `components/HeaderBar.tsx`（移入）
   - `app/sso-authorize/LoginView.tsx` → `components/LoginView.tsx`（抽取通用版，接受 `onLoggedIn` + `namespace`）
   - `app/sso-authorize/QRLoginView.tsx` → `components/QRLoginView.tsx`（抽取通用版，接受 `onLoggedIn`）
   - `app/sso-authorize/PasskeyLoginView.tsx` → `components/PasskeyLoginView.tsx`（抽取通用版，接受 `onLoggedIn`）
   - 新建 `components/PageFrame.tsx`（从 page.client.tsx 的 PageFrame 抽取）
3. **SSO 页面适配**：修改 `app/sso-authorize/page.client.tsx` 及删除被抽取的 4 个文件，改为 import `@/components/` 下的通用组件
4. **Token Service**：`services/token/api.ts`
5. **BFF 路由（Next.js）**：`app/api/tokens/**`
6. **BFF 路由（EdgeOne）**：`edge-functions/api/tokens/**`
7. **i18n**：更新 `messages/*.json`
8. **Store**：`app/console/store.ts` + `app/console/apikeys/store.ts`
9. **控制台页面**：`app/console/` 全套文件（PageFrame + ConsoleView + LoginView）
10. **API Key 页面**：`app/console/apikeys/` 全套文件
11. **验证**：`pnpm lint` + `pnpm build`
