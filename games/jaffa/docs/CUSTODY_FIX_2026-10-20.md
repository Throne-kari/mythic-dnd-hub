# 雅法 v3 物证与订单修复

本次只改 `maturity.mjs`、定向检查与本文；原 v2、`docs/source`、运行房间和既有 ZIP 不变。

- 具名证据把 `note` 原件交 `marta` 居民保管，队伍库存移除原件。队伍、达乌德各持一份有独立 id 的副本；队伍另有原件接收收据。两份副本不再全记队伍名下。
- 封存证据把同一原件交 `marta` 密封保管；队伍只拿封存收据，仍真实扣 2GP，不生成具名副本。
- 私人维护把 `basin.holder` 改为行动角色 id，保留铜盂实际所在地点和烬客的安家事实。取得器具不强迫烬客搬家或提供下一次劳动。
- 公开余账新增修箍订单一行，读取 `orderDone` 与 `rewards.kilnOrder`：完成时显示材料 2GP、实收 6GP、净 4GP；未完成时明确未领取。六种主结局共用此账，已交货不会因后来退出或损失消失。

定向检查：`node --check maturity.mjs`、`node --check tools/verify-custody-fixes.mjs` 与 `node tools/verify-custody-fixes.mjs` 通过。后者只构造五组合同夹具，不走完整玩法、不启动服务/浏览器、不读写个人存档；证据在 `CUSTODY_FIX_EVIDENCE.json`。旧 `verify-narrative.mjs` 的物证夹具补入实际原件，当前没有重新执行其中完整路线。旧验收记录与旧包保留为旧版本证据，不冒称已经包含本修复。
