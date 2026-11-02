import type { GuideText } from "./text";

export const guideTextZh: GuideText = {
  categories: {
    access: {
      title: "访问与会话",
      summary: "个人资料、角色视图、校区和通知。",
    },
    setup: {
      title: "学校设置",
      summary: "校区、部门、原因、自定义字段和 Moodle。",
    },
    jotform: { title: "Jotform 接收", summary: "连接表单并查看提交内容。" },
    staff: { title: "员工账户", summary: "添加、编辑和管理员工账户。" },
    leads: { title: "潜在学员", summary: "从初次联系到转为学生。" },
    bookings: {
      title: "测试与试听",
      summary: "安排分级测试和试听课并记录结果。",
    },
    students: { title: "学生", summary: "学生档案、负责人、文件和学习进度。" },
    enrolments: { title: "报名", summary: "课程销售、付款和分班。" },
    classes: { title: "班级", summary: "班级、课次、考勤和每周安排。" },
    rooms: { title: "教室", summary: "教室档案和每周可用时间。" },
    forms: {
      title: "Nile Forms",
      summary: "制作、发布表单并从答复创建潜在学员。",
    },
    reports: { title: "报告", summary: "阅读报告并导出数据。" },
  },
  scenarios: {
    "manage-own-profile": {
      title: "管理个人资料",
      summary: "查看资料、修改密码和管理会话。",
      steps: [
        {
          title: "打开个人资料",
          body: "在侧边栏底部账户菜单中选择个人资料，查看姓名、邮箱和角色。",
        },
        {
          title: "修改密码",
          body: "输入当前密码，再输入两次新密码并确认修改。",
        },
        {
          title: "检查会话",
          body: "在活动会话中退出不认识的登录，或选择在所有设备上退出。",
        },
      ],
      notes: [],
    },
    "act-as-a-lower-role": {
      title: "以较低权限的角色查看",
      summary: "无需退出即可切换角色视图。",
      steps: [
        { title: "选择角色", body: "从账户菜单打开以其他角色查看并选择角色。" },
        {
          title: "调整范围",
          body: "打开顶部身份标签，限定校区、部门或班级，然后应用。",
        },
        {
          title: "返回自己的角色",
          body: "点击标签上的 X，或在菜单中选择自己的角色。",
        },
      ],
      notes: [
        "包括修改操作在内，应用使用当前查看角色的权限和范围。",
        "仅提供较低权限的角色。超级管理员、校区管理员、副经理和部门主任可使用。",
      ],
    },
    "switch-branch-workspace": {
      title: "切换校区工作区",
      summary: "选择列表和新记录所使用的校区。",
      steps: [
        {
          title: "打开校区选择",
          body: "校区管理员、副经理、教务专员和 SSA 登录后选择校区。",
        },
        { title: "选择校区", body: "列表、新记录和概览将使用选定校区。" },
        { title: "稍后切换", body: "使用侧边栏底部姓名上方的工作区选择器。" },
      ],
      notes: ["超级管理员跨校区工作，没有工作区选择器。"],
    },
    "read-notifications": {
      title: "阅读通知",
      summary: "查看未读通知或清空自己的列表。",
      steps: [
        {
          title: "打开通知",
          body: "从首页分组打开通知。未读标签页只显示未读项目。",
        },
        {
          title: "标为已读",
          body: "使用全部标为已读，或逐项标记；不会删除通知。",
        },
        { title: "清空列表", body: "选择全部删除并确认。仅删除属于你的副本。" },
      ],
      notes: [],
    },
    "add-a-branch": {
      title: "添加校区",
      summary: "为潜在学员、学生和班级创建校区。",
      steps: [
        { title: "打开校区", body: "从人员与场所分组打开校区并添加。" },
        {
          title: "输入资料",
          body: "填写名称、代码、时区及是否为在线校区，然后创建。",
        },
        { title: "分配员工", body: "将校区加入相关员工的校区访问范围。" },
      ],
      notes: [],
    },
    "add-a-department": {
      title: "添加部门",
      summary: "为课程和部门主任建立部门。",
      steps: [
        { title: "打开部门", body: "从人员与场所打开部门并添加。" },
        { title: "填写名称", body: "输入名称和代码，然后创建部门。" },
        {
          title: "使用部门",
          body: "在员工页面为部门主任分配部门，并在编辑课程时选择课程所属部门。",
        },
      ],
      notes: [],
    },
    "manage-action-reasons": {
      title: "管理操作原因",
      summary: "维护取消、退出和停用原因。",
      steps: [
        { title: "打开原因", body: "从设置打开操作原因，使用类型筛选列表。" },
        {
          title: "添加或编辑",
          body: "添加原因或编辑已有行；批量添加可导入 CSV。",
        },
        { title: "停用旧原因", body: "不再使用的原因应停用，不要删除。" },
      ],
      notes: ["停用的原因不用于新操作，可重新启用。"],
    },
    "set-up-areas-of-study": {
      title: "设置学习领域",
      summary: "维护学生可分级进入的学习领域。",
      steps: [
        { title: "打开学习领域", body: "从设置打开学习领域并添加。" },
        {
          title: "填写资料",
          body: "输入名称、排序和用于分级测试的 Moodle 课程；之后可编辑。",
        },
        { title: "停用旧领域", body: "停用不再提供的学习领域，保留历史记录。" },
      ],
      notes: [],
    },
    "add-a-custom-field": {
      title: "添加自定义字段",
      summary: "为员工、学生、潜在学员或校区添加额外资料。",
      steps: [
        { title: "打开自定义字段", body: "从设置打开自定义字段并添加。" },
        { title: "选择记录和类型", body: "选择实体，填写字段键、类型和名称。" },
        {
          title: "设置选项",
          body: "选择字段的选项每行一个；按需设为必填，然后创建。",
        },
      ],
      notes: ["创建后不能更改字段键。"],
    },
    "connect-moodle": {
      title: "连接 Moodle 站点",
      summary: "为课程、分组和考勤建立 Moodle 连接。",
      steps: [
        { title: "打开 Moodle", body: "从系统打开 Moodle。" },
        {
          title: "输入连接资料",
          body: "填写站点地址和 Web 服务令牌，然后连接 Moodle。",
        },
        { title: "测试连接", body: "测试连接并检查状态中的可达性和预期版本。" },
      ],
      notes: ["断开连接会移除令牌。重新连接前，课程和分组停止同步。"],
    },
    "link-a-course": {
      title: "关联 Moodle 课程",
      summary: "从 Moodle 目录关联一门课程。",
      steps: [
        { title: "打开课程", body: "从教学打开课程，选择关联 Moodle 课程。" },
        { title: "选择课程", body: "按分类筛选或搜索，选择尚未关联的课程。" },
        { title: "完成资料", body: "选择部门和总课时，然后关联课程。" },
      ],
      notes: ["目录过期时使用从 Moodle 刷新。"],
    },
    "check-system-health": {
      title: "检查系统状态",
      summary: "确认后端服务是否可访问。",
      steps: [
        { title: "打开系统状态", body: "从系统打开系统状态。" },
        {
          title: "阅读状态",
          body: "检查 API、数据库、架构、迁移和 Moodle；刷新可重新检查。",
        },
      ],
      notes: [],
    },
    "register-a-form": {
      title: "连接 Jotform 表单",
      summary: "让表单提交内容进入 EMS。",
      steps: [
        { title: "打开 Jotform", body: "从系统打开 Jotform 并连接表单。" },
        {
          title: "填写表单编号",
          body: "粘贴数字编号或 Jotform 链接；系统核对并填入名称。",
        },
        {
          title: "选择创建内容",
          body: "选择潜在学员、潜在学员加分级测试或潜在学员加试听课，设置备用校区后连接。",
        },
      ],
      notes: ["EMS 团队必须先配置 Jotform webhook，才能收到提交内容。"],
    },
    "map-form-fields": {
      title: "匹配表单字段",
      summary: "指定 Jotform 问题对应的 EMS 输入。",
      steps: [
        { title: "打开表单", body: "在 Jotform 列表中打开表单设置。" },
        {
          title: "匹配问题",
          body: "在每个 EMS 输入旁填写对应问题的唯一名称并保存。",
        },
        { title: "启用接收", body: "所有必填项匹配后开启接收提交。" },
      ],
      notes: ["所有必填输入匹配前，接收开关保持关闭。"],
    },
    "receive-a-submission": {
      title: "检查新提交",
      summary: "确认 Jotform 提交已收到并保存。",
      steps: [
        { title: "打开提交列表", body: "从表单行或设置页面打开提交列表。" },
        { title: "查看新记录", body: "每次提交都显示为一行，并标明接收时间。" },
      ],
      notes: ["没有提交到达时，先请 EMS 团队检查 webhook。"],
    },
    "read-a-submission": {
      title: "阅读提交内容",
      summary: "查看一次提交中的所有答复。",
      steps: [
        { title: "选择记录", body: "从表单的提交列表打开一行。" },
        {
          title: "阅读答复",
          body: "逐题查看，可按邮箱查找潜在学员或在 Jotform 打开。",
        },
      ],
      notes: [],
    },
    "invite-staff": {
      title: "添加员工",
      summary: "通过邀请链接或临时密码创建账户。",
      steps: [
        { title: "打开员工", body: "从人员与场所打开员工并添加。" },
        {
          title: "填写账户",
          body: "输入姓名、邮箱和角色，选择邀请链接或手动密码。",
        },
        {
          title: "设置范围并创建",
          body: "选择校区范围并创建；安全分享一次性链接或密码。",
        },
      ],
      notes: [
        "校区管理员可添加副经理及以下角色；副经理可添加部门主任、教务专员、SSA 和教师。",
      ],
    },
    "edit-staff": {
      title: "编辑员工",
      summary: "修改员工资料、校区范围或角色。",
      steps: [
        { title: "查找员工", body: "打开员工详情并编辑，也可使用列表行菜单。" },
        {
          title: "修改资料",
          body: "更新姓名、邮箱、联系方式或校区范围并保存。",
        },
        { title: "检查结果", body: "在详情页面核对保存的资料。" },
      ],
      notes: [
        "校区管理员管理副经理及以下角色；副经理管理部门主任、教务专员、SSA 和教师。",
        "只有超级管理员可更改角色或部门主任的部门。",
      ],
    },
    "reset-or-disable-staff": {
      title: "重置或停用员工账户",
      summary: "设置新密码，或停用和重新启用账户。",
      steps: [
        { title: "打开操作菜单", body: "在员工详情打开更多操作。" },
        {
          title: "设置密码",
          body: "生成临时密码，从一次性凭据中复制并安全分享。",
        },
        {
          title: "停用或启用",
          body: "选择原因停用会阻止登录；启用后可重新登录。",
        },
      ],
      notes: ["不能通过此菜单重置或停用自己的账户。"],
    },
    "bind-staff-moodle": {
      title: "关联员工 Moodle 账户",
      summary: "连接员工和对应的 Moodle 账户。",
      steps: [
        { title: "打开账户", body: "在员工更多操作中选择 Moodle 账户。" },
        {
          title: "创建或关联",
          body: "创建新账户，或搜索已有 Moodle 账户并确认关联。",
        },
      ],
      notes: [],
    },
    "set-up-a-teacher": {
      title: "设置教师账户",
      summary: "配置课程、可用时间和分级测试资格。",
      steps: [
        {
          title: "打开账户",
          body: "创建具有校区范围的教师账户，或打开现有教师。",
        },
        { title: "设置可教课程", body: "在课程标签页选择教师可授课的课程。" },
        {
          title: "设置时间与资格",
          body: "在可用时间中标记时段，在编辑中设置分级测试资格。",
        },
      ],
      notes: [
        "资格开关仅适用于教师。部门主任和副经理始终有资格。",
        "只有部门主任账户分配部门；教师分配可教课程。",
      ],
    },
    "add-a-lead": {
      title: "添加潜在学员",
      summary: "记录新咨询者的首次联系。",
      steps: [
        { title: "打开潜在学员", body: "从招生打开潜在学员并添加。" },
        {
          title: "填写资料",
          body: "输入姓名、邮箱、联系方式、性别和校区；先检查重复记录。",
        },
        {
          title: "保存并跟进",
          body: "创建潜在学员后，下一步卡片显示后续操作。",
        },
      ],
      notes: ["不在潜在学员上指定 SSA。教务专员由系统自动记录。"],
    },
    "work-a-lead": {
      title: "推进潜在学员流程",
      summary: "按照下一步卡片完成招生流程。",
      steps: [
        {
          title: "打开潜在学员",
          body: "查看初次联系、分级测试、试听课、注册费和学生各阶段。",
        },
        {
          title: "完成下一步",
          body: "执行卡片提供的操作，或跳过非必需的测试与试听。",
        },
        {
          title: "保持资料最新",
          body: "更新备注和跟进状态；完成操作后下一步会更新。",
        },
      ],
      notes: ["教务专员处理招生；SSA 无权访问潜在学员和预约页面。"],
    },
    "use-the-pipeline-board": {
      title: "使用潜在学员看板",
      summary: "拖动或通过菜单移动潜在学员阶段。",
      steps: [
        { title: "打开看板", body: "在潜在学员页面切换到看板视图。" },
        {
          title: "移动卡片",
          body: "拖到另一阶段或使用移动菜单；测试和试听阶段会打开预约表单。",
        },
        {
          title: "批量操作",
          body: "选择卡片后批量移到处理中、跟进、未来注册或流失阶段。",
        },
      ],
      notes: ["不能拖到已注册。转为学生时潜在学员才成为已注册。"],
    },
    "manage-lead-groups": {
      title: "查看潜在学员分组",
      summary: "查找同组的咨询者。",
      steps: [
        { title: "查看分组列", body: "潜在学员列表的分组列显示所属组。" },
        {
          title: "打开成员",
          body: "打开已分组潜在学员，查看同组成员及主要联系人。",
        },
        { title: "切换成员", body: "选择成员姓名打开其潜在学员记录。" },
      ],
      notes: [],
    },
    "mark-a-lead-lost": {
      title: "将潜在学员标为流失",
      summary: "选择原因关闭，回来时可重新打开。",
      steps: [
        {
          title: "选择操作",
          body: "从潜在学员更多操作标为流失，或将看板卡片拖到流失。",
        },
        { title: "选择原因", body: "选择设置中维护的流失原因并确认。" },
        {
          title: "按需重新打开",
          body: "在更多操作中重新打开潜在学员；流失阶段列出所有关闭的记录。",
        },
      ],
      notes: [
        "招生报告按流失原因统计这些潜在学员。",
        "重新打开会回到处理中阶段。",
      ],
    },
    "check-for-duplicates": {
      title: "检查重复记录",
      summary: "创建前查看姓名和邮箱匹配。",
      steps: [
        {
          title: "输入资料",
          body: "添加潜在学员或学生时，姓名和邮箱会自动检查。",
        },
        {
          title: "打开匹配",
          body: "查看已有记录或同名提示，选择打开检查该记录。",
        },
      ],
      notes: [
        "另一位潜在学员已用的邮箱会阻止保存。其他匹配仅警告，可选择仍然创建。",
      ],
    },
    "convert-a-lead": {
      title: "将潜在学员转为学生",
      summary: "记录注册费后创建学生账户。",
      steps: [
        { title: "完成注册费", body: "记录注册费，下一步卡片将提供创建学生。" },
        {
          title: "核对身份",
          body: "填写国籍、地址、性别、出生日期及身份证或护照；未满 18 岁须添加监护人。",
        },
        {
          title: "选择 SSA",
          body: "若负责人字段可见，选择 SSA 或保留无负责人。",
        },
        {
          title: "创建学生",
          body: "创建后打开学生详情；有推荐课程时销售表单会预填课程。",
        },
      ],
      notes: [
        "只有超级管理员、校区管理员或副经理可在转换时选择 SSA。",
        "教务专员转换时看不到负责人字段。",
      ],
    },
    "schedule-a-placement-test": {
      title: "安排分级测试",
      summary: "为潜在学员或学生预约测试。",
      steps: [
        {
          title: "从个人记录开始",
          body: "使用潜在学员下一步或学生测试与试听标签页中的预约测试。",
        },
        {
          title: "选择时间地点",
          body: "选择日期、开始时间及学习领域；线下校区选教室，在线校区填会议链接。",
        },
        {
          title: "保存预约",
          body: "确认预约后，测试显示在即将进行列表，直到记录结果。",
        },
      ],
      notes: ["线下预约需要教室；在线预约使用会议链接。"],
    },
    "schedule-review-placement": {
      title: "安排待审核测试",
      summary: "将测试请求变成已预约时段。",
      steps: [
        {
          title: "打开待审核",
          body: "在分级测试的待审核标签页查看未排期请求。",
        },
        {
          title: "安排时间",
          body: "在行中选择安排，检查请求、日期和教室后确认。",
        },
      ],
      notes: [],
    },
    "record-a-placement-result": {
      title: "记录分级测试结果",
      summary: "测试完成后保存结果。",
      steps: [
        {
          title: "打开预约",
          body: "在即将进行的测试或潜在学员详情中选择记录结果。",
        },
        {
          title: "填写结果",
          body: "输入分数或级别、指导教师，以及可选推荐课程和备注，然后保存。",
        },
      ],
      notes: [],
    },
    "change-a-placement-test": {
      title: "更改或取消测试",
      summary: "改期或选择原因取消预约。",
      steps: [
        { title: "打开行菜单", body: "打开即将进行测试的行菜单。" },
        {
          title: "更改或取消",
          body: "更改时间或教室并保存，或选择取消预约并填写原因。",
        },
      ],
      notes: [],
    },
    "schedule-a-trial-lesson": {
      title: "安排试听课",
      summary: "为潜在学员或学生预约试听。",
      steps: [
        {
          title: "从个人记录开始",
          body: "使用潜在学员下一步或学生测试与试听标签页中的预约试听。",
        },
        {
          title: "选择主题与时段",
          body: "选择课程或学习领域，再选日期、时间及教室或会议链接并预约。",
        },
        {
          title: "等待结果",
          body: "试听保留在即将进行列表直到记录结果；可先参加或跳过分级测试。",
        },
      ],
      notes: ["试听需要课程或学习领域；线下校区还需要教室。"],
    },
    "schedule-review-trial": {
      title: "安排待审核试听",
      summary: "为试听请求确定实际时段。",
      steps: [
        { title: "打开待审核", body: "在试听课页面打开待审核标签页。" },
        {
          title: "安排请求",
          body: "在行中选择安排，填写主题、日期和教室并确认。",
        },
      ],
      notes: [],
    },
    "record-a-trial-result": {
      title: "记录试听结果",
      summary: "保存试听结果和推荐课程。",
      steps: [
        {
          title: "打开试听",
          body: "从即将进行的试听或潜在学员详情打开记录结果。",
        },
        {
          title: "输入结果",
          body: "填写分数或级别、推荐课程和备注，然后保存。",
        },
        {
          title: "查看推荐",
          body: "学生页显示下一门推荐课程，潜在学员页的下一步也会显示推荐。",
        },
      ],
      notes: ["销售课程时，推荐课程会带有推荐标记。"],
    },
    "work-the-review-queue": {
      title: "处理待审核请求",
      summary: "把请求安排为实际预约。",
      steps: [
        {
          title: "查看队列",
          body: "从概览中需要关注的预约请求进入待审核列表。",
        },
        { title: "安排或取消", body: "安排该行，或在行菜单选择原因取消预约。" },
        {
          title: "保持队列清晰",
          body: "安排后的请求进入即将进行列表，待审核数量随之减少。",
        },
      ],
      notes: ["请求来自配置为潜在学员加测试或潜在学员加试听的 Jotform 表单。"],
    },
    "add-a-student": {
      title: "添加学生",
      summary: "无需潜在学员流程，直接创建学生。",
      steps: [
        { title: "打开学生", body: "从招生打开学生并添加。" },
        {
          title: "填写身份与监护人",
          body: "输入姓名、邮箱、注册费和身份资料；超级管理员还须选归属校区。",
        },
        { title: "报读课程", body: "创建后在学生课程标签页销售课程。" },
      ],
      notes: ["埃及国籍须填国家身份证；未满 18 岁须至少一位监护人。"],
    },
    "assign-an-ssa": {
      title: "为学生指定 SSA",
      summary: "选择负责学生档案的人员。",
      steps: [
        { title: "编辑学生", body: "打开学生并选择编辑。" },
        { title: "选择负责人", body: "选择 SSA 或清除负责人，然后保存更改。" },
      ],
      notes: [
        "仅超级管理员、校区管理员和副经理可更改负责人。教务专员只能阅读学生资料。",
      ],
    },
    "read-student-progress": {
      title: "查看学习进度",
      summary: "阅读学生的学习和报告标签页。",
      steps: [
        { title: "打开学生", body: "进入学生的学习标签页。" },
        {
          title: "查看 Moodle 学习",
          body: "检查各班的 Moodle 成绩和完成情况。",
        },
        {
          title: "阅读报告",
          body: "在报告标签页查看学业报告，可打印或另存为文件。",
        },
      ],
      notes: [],
    },
    "add-a-document": {
      title: "添加学生文件",
      summary: "上传护照、身份证和附件。",
      steps: [
        { title: "打开文件", body: "在学生概览中找到文件区域。" },
        { title: "上传文件", body: "选择上传，指定用途和文件后再次确认上传。" },
        {
          title: "下载或归档",
          body: "行菜单提供下载；可编辑学生的员工也能归档。",
        },
      ],
      notes: [
        "存储不可用时会提示暂停上传；已有文件仍可查看。",
        "教务专员可查看和下载，但不能上传或归档。",
      ],
    },
    "disable-a-student": {
      title: "停用学生",
      summary: "保留历史记录并关闭学生档案。",
      steps: [
        { title: "打开操作菜单", body: "从学生更多操作选择停用学生。" },
        { title: "确认原因", body: "选择原因并确认；该学生不能新报读课程。" },
        {
          title: "重新启用",
          body: "仍能查看停用档案的管理员可从同一菜单启用。",
        },
      ],
      notes: [
        "停用后保留历史；教务专员和 SSA 不再看到该学生。",
        "更多操作仅对管理员和该学生自己的 SSA 显示。",
      ],
    },
    "sell-a-course": {
      title: "销售课程",
      summary: "为学生创建课程销售记录。",
      steps: [
        {
          title: "开始销售",
          body: "在学生课程标签页销售，或在报名中先搜索学生。",
        },
        { title: "填写课程和费用", body: "选择课程、班型、总费用和已付金额。" },
        { title: "选择班级", body: "现在选班或稍后分班，然后确认销售。" },
      ],
      notes: ["全额付款并有 Moodle 账户后才能入班，否则销售保持等待。"],
    },
    "record-a-payment": {
      title: "记录付款",
      summary: "更新课程销售的已付金额。",
      steps: [
        {
          title: "查找销售",
          body: "从报名的等待列表或学生课程标签页找到销售。",
        },
        {
          title: "保存金额",
          body: "打开记录付款，更新总额或已付金额并保存；余额自动更新。",
        },
      ],
      notes: [],
    },
    "place-in-a-class": {
      title: "将学生分入班级",
      summary: "把已付款的销售记录加入班级。",
      steps: [
        { title: "找到销售", body: "在已付清的等待销售上选择加入班级。" },
        {
          title: "选择班级",
          body: "查看同课程同校区的启用班级和剩余名额；满员班级不可添加。",
        },
        { title: "确认加入", body: "确认加入班级，学生即进入班级名单。" },
      ],
      notes: ["仅付清后才显示加入班级。", "学生须有 Moodle 账户。"],
    },
    "mark-left-or-cancel": {
      title: "标记退出或取消销售",
      summary: "选择原因结束未继续的销售。",
      steps: [
        {
          title: "打开行菜单",
          body: "从学生课程标签页或报名打开销售菜单。",
        },
        { title: "选择操作", body: "选择标记退出或取消销售，填写原因并确认。" },
        {
          title: "查看状态",
          body: "记录进入退出或取消标签页，仍保留在学生历史中。",
        },
      ],
      notes: ["退出仅适用于下一级销售；取消仅适用于等待销售且不可撤销。"],
    },
    "complete-a-level": {
      title: "完成一个级别",
      summary: "课程结束后将报读标为完成。",
      steps: [
        {
          title: "打开行菜单",
          body: "在学生或报名中打开已入班销售的菜单。",
        },
        { title: "标为完成", body: "确认完成操作，销售进入已完成列表。" },
      ],
      notes: ["学完课程使用完成；不再继续下一级使用退出。"],
    },
    "create-a-class": {
      title: "创建班级",
      summary: "设置课程、教师、名额和日期。",
      steps: [
        { title: "打开班级", body: "从教学打开班级并添加。" },
        {
          title: "填写资料",
          body: "选择课程、班型、名额、起止日期和教师；超级管理员还须选校区。",
        },
        {
          title: "设置常用时段",
          body: "设置星期和时间；在线班填会议链接后创建。",
        },
      ],
      notes: [],
    },
    "bind-moodle-group": {
      title: "关联 Moodle 分组",
      summary: "关联班级分组以同步考勤和成绩。",
      steps: [
        { title: "打开班级", body: "从更多操作选择创建 Moodle 分组。" },
        {
          title: "创建或关联",
          body: "创建分组，或搜索并关联现有分组；然后使用 Moodle 同步。",
        },
      ],
      notes: [],
    },
    "propose-sessions": {
      title: "规划并预约课次",
      summary: "按照教师和教室可用时间排课。",
      steps: [
        { title: "打开课次", body: "从班级课次标签页打开规划课次。" },
        {
          title: "查找时段",
          body: "输入各星期的时长和日期范围，查找可用时段。",
        },
        { title: "预约", body: "核对建议时段并确认预约这些课次。" },
      ],
      notes: ["建议时段要求教师和教室同时空闲。"],
    },
    "change-a-session": {
      title: "更改或取消课次",
      summary: "调整已安排课次的时间。",
      steps: [
        { title: "查找课次", body: "在班级课次标签页找到即将进行的课次。" },
        {
          title: "更改或取消",
          body: "更改日期、开始时间和时长，或取消；过去的课次不能更改。",
        },
      ],
      notes: [],
    },
    "mark-attendance": {
      title: "记录考勤",
      summary: "课次开始后记录学生出勤。",
      steps: [
        {
          title: "打开课次",
          body: "使用班级考勤标签页；教师也可从我的一周进入。",
        },
        { title: "保存考勤", body: "逐人标记或将所有人标为出席，然后保存。" },
      ],
      notes: ["考勤保存在 Moodle；课程必须先配置考勤活动。"],
    },
    "read-roster-and-grades": {
      title: "查看名单和成绩",
      summary: "阅读班级学生名单及课程成绩。",
      steps: [
        { title: "打开班级", body: "学生标签页显示班级名单。" },
        { title: "查看成绩", body: "成绩标签页显示 Moodle 的课程成绩。" },
      ],
      notes: [],
    },
    "plan-my-week": {
      title: "规划我的一周",
      summary: "逐日查看自己的授课安排。",
      steps: [
        { title: "打开我的一周", body: "从教学打开我的一周。" },
        {
          title: "查看每天安排",
          body: "课次显示时间、班级和教室；无课日显示空闲。",
        },
        { title: "切换星期", body: "使用上一周、下一周或本周返回当前星期。" },
      ],
      notes: [],
    },
    "add-a-room": {
      title: "添加教室",
      summary: "为线下预约和授课创建教室。",
      steps: [
        { title: "打开教室", body: "从教学打开教室并添加。" },
        {
          title: "填写资料",
          body: "输入名称和名额；超级管理员选校区，然后创建。",
        },
        {
          title: "设置时间",
          body: "打开可用时间网格；管理员和 SSA 可标记时段。",
        },
      ],
      notes: [],
    },
    "set-room-availability": {
      title: "设置教室可用时间",
      summary: "标记可预约的时段。",
      steps: [
        { title: "打开教室", body: "在每周网格中使用上一周、今天和下一周。" },
        {
          title: "标记时段",
          body: "选择可用、不可用或清除后标记小时；已预约时段锁定。",
        },
        { title: "保存", body: "保存更改，排课将使用这些时段。" },
      ],
      notes: ["课次只能安排在教室可用时段。"],
    },
    "build-a-form": {
      title: "制作表单",
      summary: "用所需问题创建 Nile Form。",
      steps: [
        { title: "打开表单", body: "从首页打开表单并新建。" },
        {
          title: "填写基本资料",
          body: "输入英文和阿拉伯文标题、类别、校区和起始模板，然后创建。",
        },
        {
          title: "添加问题并保存",
          body: "在制作标签页添加问题并保存草稿；发布前不会公开。",
        },
      ],
      notes: [],
    },
    "publish-a-form": {
      title: "发布表单",
      summary: "分享链接或指定填写人员。",
      steps: [
        { title: "打开分享", body: "在表单分享标签页选择发布。" },
        {
          title: "设置填写人",
          body: "填写链接名称；选择任何持链接者、已登录员工或指定人员，然后发布。",
        },
        {
          title: "分配人员",
          body: "在链接中分配角色、校区、部门、员工或班级教师。",
        },
      ],
      notes: ["指定人员在表单页面的待填写标签页找到表单。"],
    },
    "review-a-response": {
      title: "审核答复",
      summary: "阅读答复并记录决定。",
      steps: [
        { title: "打开答复", body: "使用具体表单或表单页面的答复标签页。" },
        {
          title: "阅读并决定",
          body: "打开答复，选择接受、审核中或拒绝，可添加备注。",
        },
      ],
      notes: [],
    },
    "create-a-lead-from-a-response": {
      title: "从答复创建潜在学员",
      summary: "把招生表单答复转为潜在学员。",
      steps: [
        { title: "打开答复", body: "选择招生表单的一份答复。" },
        {
          title: "创建潜在学员",
          body: "创建潜在学员会预填姓名、邮箱、电话和答复内容。",
        },
        {
          title: "保存潜在学员",
          body: "核对并创建；答复被接受并显示打开潜在学员。",
        },
      ],
      notes: ["仅招生员工可对招生表单中未被拒绝的答复创建潜在学员。"],
    },
    "import-from-jotform": {
      title: "导入 Jotform 答复",
      summary: "将历史答复导入已发布的 Nile Form。",
      steps: [
        {
          title: "打开导入",
          body: "在表单页面选择从 Jotform 导入，仅超级管理员可见。",
        },
        {
          title: "匹配并导入",
          body: "选择源表单和目标已发布表单并匹配问题；先检查行，再导入可用行。",
        },
      ],
      notes: [],
    },
    "read-reports": {
      title: "阅读报告",
      summary: "查看招生、预约、报读和班级统计。",
      steps: [
        { title: "打开报告", body: "从首页打开报告，选择当前角色允许的报告。" },
        {
          title: "选择时间范围",
          body: "选择时期；超级管理员还可选择校区。班级总是显示今天的状态。",
        },
        {
          title: "查看细分",
          body: "卡片、表格和图表按阶段、状态或负责人细分总数。",
        },
      ],
      notes: ["无权访问的报告链接会打开第一份可用报告。"],
    },
    "export-a-report": {
      title: "导出报告",
      summary: "将当前报告下载为 CSV。",
      steps: [
        { title: "设置报告", body: "选择需要的报告、时期和校区。" },
        {
          title: "导出 CSV",
          body: "使用页面顶部导出按钮；文件中的阿拉伯文姓名可在 Excel 正常阅读。",
        },
      ],
      notes: ["CSV 使用与屏幕相同的报告、时期和校区。"],
    },
  },
};
