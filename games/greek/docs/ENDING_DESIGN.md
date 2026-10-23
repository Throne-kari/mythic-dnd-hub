# 24种结局的因果设计与可达见证

这24种是同一四章战役的互斥终局，不把不同标题的三轴排列当内容。关键差别落在谁能发令和罢免、具体人物能否拒绝、土地/船/神圣誓约怎样持续、谁实际付账。期限失败另由系统处理。

## 分支结构

| 最终公共授权 | 分支数 | 不可互换的主要代价 |
| --- | --- | --- |
| 居住者大会 assembly | 5 | 公共粮约、役魂军权、有限外援、完整权利与未清索赔 |
| 仪式托管 temple | 4 | 菲洛身体控制、梅莉娅本人可撤回承诺、完整节令公共责任与局部收容 |
| 议事会 council | 4 | 航税债、土地支配、赔偿执行与行政拖延 |
| 守城临时军政 regency | 4 | 永久役魂、特定公开交接、可拒发军粮轮值与无粮制衡延期 |
| 实际船队迁徙 diaspora | 4 | 三年指定劳动、双岸返航、完整集体安置与分户落岸待遇 |
| 无统一公共授权 silence | 3 | 自愿有准备还河、公共生产组织断裂、共同安全断裂 |

每组条件显式排除较早兄弟，并有最后补集，六个授权值互斥。引擎不是“取第一项看起来合理”，而是所有条件必须恰好命中1项。分支顺序有因果意义：拘禁菲洛先于好守桥方案，役魂实际军权先于纸面议会，债务船的既有劳动约先于迁徙的新名称。完整宪章排除菲洛被拘与明确未赎历史伤害；外国航税本身绝不被当作人身劳役。

标准见证是 data/ending-witnesses.json 首条 threefold_covenant。所有24条均为实际36次选择，作者已用独立QA提供的路线执行器真实移动/旅行/choose/finish回放，各第37日唯一命中。没有直接写endingId动作，没有注入旗标、资源、生命或随机结果。见证不含战斗，战斗与粮/币交涉另验。

## 逐结局差异与条件

### 仍有投票权的空粮仓（bread_council）

- 权力：由居民大会选举并每月罢免的配给委员会掌短期采购权，无权取消欠粮者票权。
- 人物：克勒奥承认公共粮约失效，带账员去邻城谈临时采购；伊昂替没有公民印的人保留发言席。
- 世界：原城失去统一粮约与共同采购、播种保障，私存的完好种子与安全田地并不自动消失。
- 代价：共同保障与统一议价能力断裂，家庭必须自行组织生产或寻找别处土地。
- 跨章伏笔：第一夜种粮争夺、退潮后的议事试种与关门前主动承认空田。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：ratify_common_grain→accept_empty_local_fields

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "assembly"
      }
    },
    {
      "flags": {
        "harvest_final": "lost"
      }
    }
  ]
}
```

### 白昼开会，夜里点名（day_assembly_night_legion）

- 权力：民选大会保留纸面立法权，掌骨符的守城官控制实际安全，形成不平等双重权力。
- 人物：梅莉娅撤回守桥与留岸承诺，离开强役体系；夜哨孙女组织偷取骨符的行动。
- 世界：城墙仍由不许拒绝的亡者维持，大会不能靠一张票令他们自由。
- 代价：获得稳定城防，代价是身体自由底线被军团架空，盗符者会被追捕。
- 跨章伏笔：绑骨、常备夜哨与最后关门时永久役魂的连续支持。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：ask_nightwatch_consent→chain_nightwatch；free_all_bound_dead→perpetuate_dead_legion

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "assembly"
      }
    },
    {
      "flags": {
        "burial_final": "chain"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_final": "lost"
            }
          }
        ]
      }
    }
  ]
}
```

### 有边界的外援议会（harbor_protectorate）

- 权力：本地居民大会管普通法与庇护，海岛债权会管三年航税和对半商业法庭；有限和约禁止驻军与人质。
- 人物：阿格莱承担粮价上限，克勒奥可追问货量；菲洛无论留城还是渡海，都不被条约当作神圣担保，拘禁者也不因有限和约获得免责。
- 世界：港口有稳定船期，原城仍保普通司法与出境权。
- 代价：航税三年不能单方收回，居民须支付真实债额与接收岛口粮。
- 跨章伏笔：退潮后的议事港租、债务非人身化与最后有限和约。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：open_public_port→grant_foreign_port；ratify_common_grain→ratify_foreign_credit

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "assembly"
      }
    },
    {
      "all": [
        {
          "flags": {
            "harvest_final": "foreign"
          }
        },
        {
          "flags": {
            "oracle_foreign": "peace"
          }
        }
      ]
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_final": "lost"
            }
          },
          {
            "flags": {
              "burial_final": "chain"
            }
          }
        ]
      }
    }
  ]
}
```

### 有名者的未竟宪章（threefold_covenant）

- 权力：包括妇女、外邦与欠债户的居住者大会执政，个人退出和基本葬仪不由多数取消。
- 人物：多罗斯的执行责任留在法院，梅莉娅与伊昂各自保留拒绝；克勒奥受居民选举监督。
- 世界：已知姓名保存、强役终止、可靠新种源与三处来源档案并存，神意仍不为丰收背书。
- 代价：旧祭典预算、修堤劳动和补偿金已真实支付；不可复得的尸物与亡者不能复生。
- 跨章伏笔：第一夜的姓名与证物、公开命令链赔偿、三处副本、净种试验和证人庇护。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。标准无同章交叉前置路线，供自由线序验证。

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "assembly"
      }
    },
    {
      "all": [
        {
          "any": [
            {
              "flags": {
                "burial_final": "free"
              }
            },
            {
              "flags": {
                "burial_final": "covenant"
              }
            }
          ]
        },
        {
          "flags": {
            "harvest_final": "commons",
            "burial_names": true,
            "burial_citizenship": "all",
            "burial_reparation": "paid",
            "burial_restitution": "repaired",
            "oracle_archives": "distributed",
            "oracle_witnesses": "safe",
            "harvest_seed_quality": "clean",
            "oracle_teacher": "trial",
            "oracle_foreign": "peace"
          }
        },
        {
          "any": [
            {
              "flags": {
                "oracle_philo": "free"
              }
            },
            {
              "flags": {
                "oracle_philo": "exile"
              }
            }
          ]
        },
        {
          "not": {
            "any": [
              {
                "flags": {
                  "burial_erased": true
                }
              },
              {
                "flags": {
                  "burial_flooded": true
                }
              },
              {
                "flags": {
                  "demeter_share_broken": true
                }
              },
              {
                "flags": {
                  "oracle_staged": true
                }
              }
            ]
          }
        }
      ]
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_final": "lost"
            }
          },
          {
            "flags": {
              "burial_final": "chain"
            }
          },
          {
            "all": [
              {
                "flags": {
                  "harvest_final": "foreign"
                }
              },
              {
                "flags": {
                  "oracle_foreign": "peace"
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### 索赔席旁的共和国（unfinished_republic）

- 权力：居民大会执政，受害家属另保对未清损失提出复审的权利，不授任何集团永久席位。
- 人物：妮莎保留尚未得到回答的腕带；伊昂记录反对书，克勒奥不得以好消息注销旧债。
- 世界：基本公共生活延续，但缺名、封存、债权或局部自治至少留下一道制度裂口。
- 代价：每年预算先接受索赔审查，部分支持者厌倦无法结清的旧案。
- 跨章伏笔：可修复而不能抹去的早期失败，以及后章选择有限合作。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：record_names→buy_silence

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "assembly"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_final": "lost"
            }
          },
          {
            "flags": {
              "burial_final": "chain"
            }
          },
          {
            "all": [
              {
                "flags": {
                  "harvest_final": "foreign"
                }
              },
              {
                "flags": {
                  "oracle_foreign": "peace"
                }
              }
            ]
          },
          {
            "all": [
              {
                "any": [
                  {
                    "flags": {
                      "burial_final": "free"
                    }
                  },
                  {
                    "flags": {
                      "burial_final": "covenant"
                    }
                  }
                ]
              },
              {
                "flags": {
                  "harvest_final": "commons",
                  "burial_names": true,
                  "burial_citizenship": "all",
                  "burial_reparation": "paid",
                  "burial_restitution": "repaired",
                  "oracle_archives": "distributed",
                  "oracle_witnesses": "safe",
                  "harvest_seed_quality": "clean",
                  "oracle_teacher": "trial",
                  "oracle_foreign": "peace"
                }
              },
              {
                "any": [
                  {
                    "flags": {
                      "oracle_philo": "free"
                    }
                  },
                  {
                    "flags": {
                      "oracle_philo": "exile"
                    }
                  }
                ]
              },
              {
                "not": {
                  "any": [
                    {
                      "flags": {
                        "burial_erased": true
                      }
                    },
                    {
                      "flags": {
                        "burial_flooded": true
                      }
                    },
                    {
                      "flags": {
                        "demeter_share_broken": true
                      }
                    },
                    {
                      "flags": {
                        "oracle_staged": true
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### 被截去的破句（philo_captive_sanctuary）

- 权力：神庙以连续圣言维系捐粮，托管会名义共有却不能自由检查内泉，军官参与控制发言。
- 人物：菲洛被禁止出殿，借每次答复的重复破句抵抗；孩子的歌让她的拒绝流出墙外。
- 世界：庇护院有粮，圣域的退出权却被对神谕产量的依赖架空。
- 代价：具体牺牲菲洛的身体自由与完整话语，受益者必须面对供粮建立在拘禁之上。
- 跨章伏笔：先前集中证人、泉影解释权和最后关门时明确违背本人意愿的命令。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：free_philo_voice→bind_philo_oracle；mandate_resident_assembly→mandate_sacred_custody

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "temple"
      }
    },
    {
      "flags": {
        "oracle_philo": "bound"
      }
    }
  ]
}
```

### 不继承的守桥人（melia_bridge）

- 权力：受庇护者与祭司各半的托管会只管渡口和救济，梅莉娅本人每年确认或退出守桥约。
- 人物：梅莉娅闭门后自愿留桥，最多十年且不许儿童继任；伊昂把她的退出书交本人保管。
- 世界：被强迫的骨符不再提供屏障，轮值与净布维持短时送行。
- 代价：她付出一段人生与离乡机会，城邦承担替班和医疗，不能把她变成永远的廉价防线。
- 跨章伏笔：退潮后的议事逐魂同意，关门前本人提出、来访者可拒绝的守桥条件。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：accept_doros_confession→accept_melia_watch；mandate_resident_assembly→mandate_sacred_custody

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "temple"
      }
    },
    {
      "all": [
        {
          "flags": {
            "burial_guardian": "melia_burden",
            "melia_explicit_consent": true
          }
        },
        {
          "any": [
            {
              "flags": {
                "burial_final": "free"
              }
            },
            {
              "flags": {
                "burial_final": "covenant"
              }
            }
          ]
        },
        {
          "not": {
            "flags": {
              "melia_consent_revoked": true
            }
          }
        }
      ]
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "oracle_philo": "bound"
            }
          }
        ]
      }
    }
  ]
}
```

### 只承诺仪式的圣域（seasonal_sanctuary）

- 权力：家属与祭司轮值托管渡口、祭谷与庇护，每六个月双方各有否决权，普通法院留在人间。
- 人物：菲洛不被强迫为法令背书；女祭司守第一份祭谷，伊昂保存石刻可证与泉影未解的界线。
- 世界：归魂处境受仪式实在改变，农田仍面对节令与神意的不确定。
- 代价：城邦放弃把神谕当作万能统治工具，也付出固定祭谷与活人修堤的负担。
- 跨章伏笔：送亡旧歌、净布渡资、第一份谷与阿波罗不发命令的一日。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：mandate_resident_assembly→mandate_sacred_custody

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "temple"
      }
    },
    {
      "all": [
        {
          "any": [
            {
              "flags": {
                "burial_final": "free"
              }
            },
            {
              "flags": {
                "burial_final": "covenant"
              }
            }
          ]
        },
        {
          "flags": {
            "harvest_seed_quality": "clean"
          }
        },
        {
          "any": [
            {
              "flags": {
                "harvest_final": "commons"
              }
            },
            {
              "flags": {
                "harvest_final": "ration"
              }
            }
          ]
        },
        {
          "not": {
            "flags": {
              "demeter_share_broken": true
            }
          }
        }
      ]
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "oracle_philo": "bound"
            }
          },
          {
            "all": [
              {
                "flags": {
                  "burial_guardian": "melia_burden",
                  "melia_explicit_consent": true
                }
              },
              {
                "any": [
                  {
                    "flags": {
                      "burial_final": "free"
                    }
                  },
                  {
                    "flags": {
                      "burial_final": "covenant"
                    }
                  }
                ]
              },
              {
                "not": {
                  "flags": {
                    "melia_consent_revoked": true
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### 只能收容的圣域（winter_cloister）

- 权力：托管会退为局部食宿与送亡网络，只能在既有粮契和役魂处置内照护，无法统一改变它们。
- 人物：祭司安排床位，克勒奥按实际粮约提供能拨出的份额；伊昂保留未能兑现的公共边界。
- 世界：统一释魂、可靠种源或公共粮制度至少一项未同时落实，庇护可延续，完整仪式自治没有形成。
- 代价：保住局部照护，却失去把送亡、祭谷与独立供粮合成同一公共责任的能力。
- 跨章伏笔：限期托管、粮储分配，以及不能靠一纸自治抹掉旧伤。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：record_unfinished_oracle→keep_sacred_silence；mandate_resident_assembly→mandate_sacred_custody；返修：实际采用庄园粮制度，而非仅凭不解释泉影推导财政缺口。

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "temple"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "oracle_philo": "bound"
            }
          },
          {
            "all": [
              {
                "flags": {
                  "burial_guardian": "melia_burden",
                  "melia_explicit_consent": true
                }
              },
              {
                "any": [
                  {
                    "flags": {
                      "burial_final": "free"
                    }
                  },
                  {
                    "flags": {
                      "burial_final": "covenant"
                    }
                  }
                ]
              },
              {
                "not": {
                  "flags": {
                    "melia_consent_revoked": true
                  }
                }
              }
            ]
          },
          {
            "all": [
              {
                "any": [
                  {
                    "flags": {
                      "burial_final": "free"
                    }
                  },
                  {
                    "flags": {
                      "burial_final": "covenant"
                    }
                  }
                ]
              },
              {
                "flags": {
                  "harvest_seed_quality": "clean"
                }
              },
              {
                "any": [
                  {
                    "flags": {
                      "harvest_final": "commons"
                    }
                  },
                  {
                    "flags": {
                      "harvest_final": "ration"
                    }
                  }
                ]
              },
              {
                "not": {
                  "flags": {
                    "demeter_share_broken": true
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### 以港口偿还的城（creditor_city）

- 权力：海岛债权会掌航税与商业裁断；若已接受扩法院与港卫，普通债务和出境也受其监督。
- 人物：阿格莱从船长成为债权代表，克勒奥替每户解释收据；欠债户难以与清债商人取得同等话语。
- 世界：船期稳定、粮额可靠，公共权利被长期税权和既有外部条款压住。
- 代价：今后收入与一部分司法决定被抵押，最缺钱的人最难行使收回权。
- 跨章伏笔：独占港租、债务协议与最终把日常治理还给旧议事会。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：open_public_port→grant_foreign_port；ratify_common_grain→ratify_foreign_credit；mandate_resident_assembly→mandate_civic_council

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "council"
      }
    },
    {
      "flags": {
        "harvest_final": "foreign"
      }
    }
  ]
}
```

### 重新上锁的庄园仓（landed_restoration）

- 权力：旧家族凭土地与种源控制议事会，固定三季田租有程序限制，佃户仍无土地用途的最终否决。
- 人物：克勒奥留作能提出上诉的账员，农人重新领取标有庄园名的工具；多罗斯旧案按已选条款保留或封存。
- 世界：本地耕作有组织恢复，低地受损田块与外邦地权仍不平等。
- 代价：用农业连续性换回地主支配，不能把免于饥饿等同于自由拥有土地。
- 跨章伏笔：退潮后的议事粮贷抵押、最后关门时恢复庄园仓与旧议事印章。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：ratify_common_grain→restore_estate_granaries；mandate_resident_assembly→mandate_civic_council

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "council"
      }
    },
    {
      "flags": {
        "harvest_final": "estates"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_final": "foreign"
            }
          }
        ]
      }
    }
  ]
}
```

### 先审赔偿的法庭城（reparation_court）

- 权力：旧议事会受公开赔偿法院与共同粮仓双重约束，受害家属和退伍兵各半监督赔偿预算。
- 人物：多罗斯的执行签名与老师的审判并列归档；妮莎无需先原谅才领取补偿，克勒奥对大会查粮。
- 世界：官员能继续行政，预算先保基本食物与已认定损失，不能随意转作庆典。
- 代价：旧家族让出祭典预算与部分免审特权，赔偿需要多年，亡者与失物仍不可复生。
- 跨章伏笔：公开命令链、赔偿基金、老师有辩护的审理与共有粮仓。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：mandate_resident_assembly→mandate_civic_council

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "council"
      }
    },
    {
      "flags": {
        "burial_reparation": "paid",
        "harvest_final": "commons",
        "oracle_teacher": "trial"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_final": "foreign"
            }
          },
          {
            "flags": {
              "harvest_final": "estates"
            }
          }
        ]
      }
    }
  ]
}
```

### 保管封印的人（sealed_oligarchy）

- 权力：旧议事会掌执行日程和行政预算，证据可公开存在，启动审理与落实赔偿仍被程序拖延。
- 人物：老书吏保存反对书，伊昂不为封存背书；家属和港工须继续组织才能把门推开。
- 世界：行政连续，原档按实际分置或封存状态保存；主要障碍是执行，而非凭空收回三处副本。
- 代价：用短期可办事的秩序换下层持续等待，受害者必须承担再组织的风险。
- 跨章伏笔：刮名、封档、有限赦免或早期制度目标失败留下的缺口。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：pay_reparations→offer_amnesty；mandate_resident_assembly→mandate_civic_council

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "council"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_final": "foreign"
            }
          },
          {
            "flags": {
              "harvest_final": "estates"
            }
          },
          {
            "flags": {
              "burial_reparation": "paid",
              "harvest_final": "commons",
              "oracle_teacher": "trial"
            }
          }
        ]
      }
    }
  ]
}
```

### 没有退伍日的军团（dead_legion_regency）

- 权力：指挥部以永久役魂控制城门，纸面复核无法约束掌骨符者。
- 人物：梅莉娅撤回承诺，夜哨家属组织盗符；多罗斯即使不是唯一指挥者也被旧执行记录追问。
- 世界：亡者防线稳定，军粮可转给活人，神圣强制被纳入日常军政。
- 代价：以死者无法退出换活人安全，反抗者与家属失去平等申辩。
- 跨章伏笔：三次役魂诱因、军需粮权与最终授权指挥部。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：ask_nightwatch_consent→chain_nightwatch；free_all_bound_dead→perpetuate_dead_legion；mandate_resident_assembly→mandate_defense_regency

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "regency"
      }
    },
    {
      "flags": {
        "burial_final": "chain"
      }
    }
  ]
}
```

### 日落时交回的军印（sunset_command）

- 权力：守城部只掌限期防务，独立仓钥、分置档案和公开自责使居民能执行罢免，和平解除无限紧急借口。
- 人物：多罗斯交回军印并继续受审，克勒奥不向指挥官交主钥；伊昂与户会核验到期交接。
- 世界：有限和约维持外部安全，指挥部未新设永久亡者军团；尚未释放的旧役魂由独立程序继续追责，不能因军印交回就视作已得自由。
- 代价：指挥者失去自行延长权力的机会，居民承担活人守堤与外部赔款。
- 跨章伏笔：公开执行记录、三处副本、军粮分掌和最后限额和约。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：mandate_resident_assembly→mandate_defense_regency

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "regency"
      }
    },
    {
      "flags": {
        "burial_guardian": "doros_confession",
        "oracle_archives": "distributed",
        "oracle_foreign": "peace",
        "harvest_stores": "shared"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "burial_final": "chain"
            }
          }
        ]
      }
    }
  ]
}
```

### 轮到每一户的城门（rotating_militia）

- 权力：最后关门时当场重申四十日防务期限，主粮仓独立于军方，命令须经非军方印章登记；居民户会可罢免延期。
- 人物：克勒奥保共享主仓，军属与外邦工人按自愿班次守堤；伊昂保超时服役申诉，旧亡者损失仍须另案处理。
- 世界：军事防务有真实粮食制衡，不能仅凭指挥官改字无限续权；未解除的旧亡者伤害不被自动赦免。
- 代价：新的主要防务以活人轮值承担危险工时与少耕时间；未清旧役魂责任仍需继续处理，不能再将强制役使当作公共预算中不必付出的成本。
- 跨章伏笔：共享末粮提供罢免的实际手段，最终军授权重新确定期限；先前紧急权若曾成立则成为可对照先例。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：organize_resident_assembly→authorize_emergency_watch；accept_doros_confession→appoint_doros_regent；mandate_resident_assembly→mandate_defense_regency

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "regency"
      }
    },
    {
      "flags": {
        "harvest_stores": "shared"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "burial_final": "chain"
            }
          },
          {
            "flags": {
              "burial_guardian": "doros_confession",
              "oracle_archives": "distributed",
              "oracle_foreign": "peace",
              "harvest_stores": "shared"
            }
          }
        ]
      }
    }
  ]
}
```

### 被续写的紧急状态（permanent_general）

- 权力：公共主仓未共享保管，军政依军粮集中、破约挪储或共同仓解散的缺口自行延长临时权。
- 人物：普通军属最初支持保护伤兵，随后发现自己的反对也须军官批准；伊昂保存无法执行的期限。
- 世界：防务命令保持统一，期限存在但缺少独立军粮制衡；尚存副本与见证可用于以后起诉，不等于今天有力执行罢免。
- 代价：短期确定性换来长期无法罢免，家庭从支持者变成续权的人质。
- 跨章伏笔：军粮集中、受神选统治者叙事、封档或持续封锁。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：share_last_stores→give_stores_to_garrison；mandate_resident_assembly→mandate_defense_regency

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "regency"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "burial_final": "chain"
            }
          },
          {
            "flags": {
              "burial_guardian": "doros_confession",
              "oracle_archives": "distributed",
              "oracle_foreign": "peace",
              "harvest_stores": "shared"
            }
          },
          {
            "flags": {
              "harvest_stores": "shared"
            }
          }
        ]
      }
    }
  ]
}
```

### 抵岸以后还要偿还的人（bonded_convoy）

- 权力：债权会依既有船约组织指定劳动，船上协调者可处理日常却无权取消三年劳务。
- 人物：塔蕾娅保存工期与申诉通行，儿童不继承债；阿格莱为接收粮和安全承担真实成本。
- 世界：妇孺与外邦照护人有船位，接收岛保井和土地权，迁居并未自动解除受制身份。
- 代价：用三年劳动与居住区限制换确定船位和接收口粮。
- 跨章伏笔：独占港租、庄园联保债船与最后关门时船票不得改名洗白。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：build_public_fleet→finance_debt_fleet；ratify_common_grain→ratify_floating_stores；mandate_resident_assembly→mandate_floating_city

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "diaspora"
      }
    },
    {
      "flags": {
        "harvest_fleet": "debt"
      }
    }
  ]
}
```

### 两岸互认的灯火（two_shores_lighthouse）

- 权力：迁居者自选船上协调会，留守者保独立户会与返航名额，双方按月对等结算救援。
- 人物：梅莉娅按本人请求闭门后留岸行医，可随时搭返航船离去；塔蕾娅维护航路。
- 世界：城邦身份跨两岸延续，拒迁者不被注销，接收岛以有期限修港劳动获得补偿。
- 代价：长期承担往返粮与护航费用，梅莉娅承担实际留守风险而非被遗弃。
- 跨章伏笔：退潮后的议事平等船位、关门前本人留岸请求和每月返航保证。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：accept_doros_confession→ask_melia_lighthouse；ratify_common_grain→ratify_floating_stores；mandate_resident_assembly→mandate_floating_city

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "diaspora"
      }
    },
    {
      "all": [
        {
          "flags": {
            "burial_guardian": "melia_shore",
            "melia_explicit_consent": true
          }
        },
        {
          "not": {
            "flags": {
              "melia_consent_revoked": true
            }
          }
        }
      ]
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_fleet": "debt"
            }
          }
        ]
      }
    }
  ]
}
```

### 带着空白页出海的城邦（floating_citizenship）

- 权力：船上居民含妇女外邦人选可撤换协调者，海岛保本地自治，双方以一季修港劳务和公开口粮配额互约。
- 人物：塔蕾娅保照护船票，伊昂携三处对照目录；家属自己保遗物，不能被协调者征作公共财产。
- 世界：名册、可靠新种与来源档案同行，原城失去土地中心，身份仍可在海上共同确认。
- 代价：放弃故土的连续居住与原港税，承担接收者粮额和修港劳动。
- 跨章伏笔：公共船位、便携纪念、分置副本与慢筛新种，而非最后一夜万能登船。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：keep_memorial_ground→carry_memorial_aboard；ratify_common_grain→ratify_floating_stores；mandate_resident_assembly→mandate_floating_city

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "diaspora"
      }
    },
    {
      "flags": {
        "burial_memorial": "aboard",
        "harvest_seed_quality": "clean",
        "oracle_archives": "distributed"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_fleet": "debt"
            }
          },
          {
            "all": [
              {
                "flags": {
                  "burial_guardian": "melia_shore",
                  "melia_explicit_consent": true
                }
              },
              {
                "not": {
                  "flags": {
                    "melia_consent_revoked": true
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### 分户落岸的城籍（unrecognized_arrivals）

- 权力：船上可撤换的协调会保留身份目录，接收岛以分户食宿和劳动约安排居留，尚无统一土地共同体。
- 人物：塔蕾娅和家属保照护名单避免失散，伊昂保留实际存在的记录；这些记录不被说成凭空丢失，也不自动赋予接收岛地权。
- 世界：既有名册与个人船票可保存，但纪念、种源与来源档案未共同落实为一份集体落地安排，待遇由接收户具体履约。
- 代价：失去以统一土地和生产协议安置全体的能力，家庭须逐户落实工作、居留和申诉。
- 跨章伏笔：烧档或未携名册、无共同种源，以及把船当作纯逃生工具。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：distribute_copies→seal_archive；ratify_common_grain→ratify_floating_stores；mandate_resident_assembly→mandate_floating_city

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "diaspora"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "harvest_fleet": "debt"
            }
          },
          {
            "all": [
              {
                "flags": {
                  "burial_guardian": "melia_shore",
                  "melia_explicit_consent": true
                }
              },
              {
                "not": {
                  "flags": {
                    "melia_consent_revoked": true
                  }
                }
              }
            ]
          },
          {
            "flags": {
              "burial_memorial": "aboard",
              "harvest_seed_quality": "clean",
              "oracle_archives": "distributed"
            }
          }
        ]
      }
    }
  ]
}
```

### 不再向河征税的高地（river_return_commons）

- 权力：逐户同意的高地共同体共享井与轮牧，不设代表全城的印；牧人与迁户各有接纳约否决和退出权。
- 人物：俄瑞斯解除奠基役使，伊萨拆去经同意退让的围栏；家属保留拒迁与救援通道。
- 世界：部分旧田归潮，城邦缩为分散生产与祭约网络，神意不被声称已批准。
- 代价：放弃原港税与大城规模，以高地修路轮牧和更小耕地承担生活。
- 跨章伏笔：解除奠基誓约、高地接纳与最后逐户同意退地，缺一不可。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：build_living_levee→consent_highland_retreat；hold_fields_with_labor→return_floodplain_with_consent；mandate_resident_assembly→renounce_single_city_mandate

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "silence"
      }
    },
    {
      "flags": {
        "burial_final": "free",
        "burial_founding": "released",
        "harvest_floodplan": "retreat",
        "harvest_fields": "flooded",
        "river_return_consent": true,
        "highland_consent": true
      }
    }
  ]
}
```

### 各自寻找下一季（seedless_departure）

- 权力：家庭与互助劳队分头决定土地和采购，无统一粮约代表全城议价，私存种子仍归当事人。
- 人物：克勒奥把工具与技能名单交到出行或留耕队，妮莎帮助无亲属儿童结伴；没有人能代所有家庭承诺下一季。
- 世界：原城失去统一粮约与共同采购、播种保障，私存的完好种子与安全田地并不自动消失。
- 代价：共同保障与统一议价能力断裂，家庭必须自行组织生产或寻找别处土地。
- 跨章伏笔：吃掉最后种粮、未能恢复本地播种与最后关门时明确承认空田。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：ratify_common_grain→accept_empty_local_fields；mandate_resident_assembly→renounce_single_city_mandate

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "silence"
      }
    },
    {
      "flags": {
        "harvest_final": "lost"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "burial_final": "free",
              "burial_founding": "released",
              "harvest_floodplan": "retreat",
              "harvest_fields": "flooded",
              "river_return_consent": true,
              "highland_consent": true
            }
          }
        ]
      }
    }
  ]
}
```

### 每扇门都只保门内的人（gates_apart）

- 权力：各门楼与街区自行订安全约，户内能互助，城际通行与公共申辩无统一保证。
- 人物：老书吏替不同街区递送反对书，塔蒙为无人接纳的影子点灯；无人能代表所有人承诺开门。
- 世界：部分仓、田或仪式仍存在，主要损失是共同安全与可跨街区使用的权利。
- 代价：个人过门须再找担保，救援易被地方仇怨截断，城邦不再共同承担风险。
- 跨章伏笔：不授权、分段护岸、分散档案或无法落实统一交接的累积。
- 可达证据：见证文件同名endingId，36次真实选择。完整36次剧情选择；每章依葬仪、粮路、神谕推进。移动/旅行由执行器按真实地图完成；没有补资源、改旗标或设置endingId。相对标准路线改变：mandate_resident_assembly→renounce_single_city_mandate

实际条件：

```json
{
  "all": [
    {
      "flags": {
        "oracle_constitution": "silence"
      }
    },
    {
      "not": {
        "any": [
          {
            "flags": {
              "burial_final": "free",
              "burial_founding": "released",
              "harvest_floodplan": "retreat",
              "harvest_fields": "flooded",
              "river_return_consent": true,
              "highland_consent": true
            }
          },
          {
            "flags": {
              "harvest_final": "lost"
            }
          }
        ]
      }
    }
  ]
}
```

## 修订记录与不越界断言

首轮原文归档保留，本轮已针对独立叙事复核逐项改写：配给不凭空声称已核货；毁板只可重建并标空白；自责不等于关押英雄；船货和军饷直接发放均说明不入队伍储备；全文不以信任数值代本人同意。神话实际代价包括失护岸后的活堤成本、释魂后的骨灰田枯萎、先许祭谷后的真实破约。

叙事复核发现的结局不一致亦已修：自由宪章不能掩盖拘禁；同意守桥不覆盖菲洛受控；航税不等于债船劳动；共同粮约解散不等于好种子消失；未有集体安置不否认既有名册；共享主仓不能被无因改写为无制衡军政；三处副本继续存在时寡头阻碍必须是执行拖延。更多独立意见与验收结果以 NARRATIVE_REVIEW.md 和 ACCEPTANCE.md 为准，未因作者跑通见证就宣称所有叙事均免审。
