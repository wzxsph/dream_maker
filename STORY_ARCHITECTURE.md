# 短篇互动小说架构

本项目统一使用 **微场景锁结局三幕架构**。目标是让 AI 生成更快、更稳，同时保留足够的点击爽感和改写空间。

## 核心原则

1. **微场景**：每个故事锁定一个核心场景，最多扩展到一个相邻小空间。故事时间控制在 10-30 分钟内，不跳地点、不跳时间、不切换主视角。
2. **小演员表**：最多 3 个有姓名角色：主角、压力源、见证者/盟友。其他人只能作为“人群、同事、家人”等集合出现。
3. **伪开放式**：玩家选择改变手段、代价、谁先暴露，但不改变故事必须收束的结局走向。
4. **锁结局**：开场时在 `story_state.architecture.ending_lane` 中确定结局走向，后续续写和用户改写都不能更换。
5. **高频钩子**：每个节点都先给可见压力，再给信息差、反转或强情绪推进。

## 结局走向

`ending_lane` 只能从三类中选择：

- `truth_reversal`：真相翻盘。关键证据或隐藏规则公开，主角夺回主动权，主要误会被解决。
- `price_escape`：代价脱身。主角脱离即时陷阱，但舍弃某个关系、身份、承诺或安全感。
- `role_swap`：身份换位。对手用来压制主角的身份、规则或资源反噬，对局权力发生反转。

## 固定节点图

第一幕：

```text
node_0
  ├─ node_1_a
  └─ node_1_b
       ↓
node_2 → __GENERATE_NEXT__
```

第二幕：

```text
node_5
  ├─ node_6_a
  └─ node_6_b
       ↓
node_7 → __GENERATE_NEXT__
```

第三幕：

```text
node_8
  ├─ node_9_a
  └─ node_9_b
       ↓
node_10_ending
```

## 生成约束

- 每幕固定 4 个节点，非最终幕末尾通过 `__GENERATE_NEXT__` 进入续写面板。
- 每个非结局节点必须有 1-2 个具体动作选项，禁止只写“继续”“下一步”“进入下一幕”。
- 用户改写只能作为“下一幕出现的新变量”，不能推翻已发生事实、场景锁和 `ending_lane`。
- 第二幕末尾仍可由后端统一插入广告锁，但广告节点必须复用 `node_7`，不额外扩展节点图。

## 代码落点

- 架构常量：`backend/config/storyArchitecture.js`
- 初始生成：`backend/prompts/storyContentPrompt.js`
- 续写生成：`backend/prompts/continueChunkPrompt.js`
- 图结构校验：`backend/services/graphValidator.js`
- Mock 兜底：`backend/mock/mockInitial.js`、`backend/mock/mockContinue.js`
