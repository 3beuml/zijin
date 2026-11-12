/**
 * 档案卡 + 编辑弹层（v0.3）。
 * 铁律：不存电话/住址等敏感信息（隐私契约，accept.mjs 也禁手机号）。
 * 分包导师可改——两份分包名单对不上的坑（teacher 教训 #1.1），让老师自己一指头改掉。
 */
import { useState } from 'react';
import type { AppData, Student } from '../../domain/types.ts';

export function ProfileCard({
  data,
  student,
  onUpdate,
}: {
  data: AppData;
  student: Student;
  onUpdate: (next: AppData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  const save = async (patch: Partial<Student>) => {
    await onUpdate({
      ...data,
      students: data.students.map((s) => (s.id === student.id ? { ...s, ...patch } : s)),
    });
    setEditing(false);
  };

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">档案</h2>
        <button className="link-btn" onClick={() => setEditing(true)}>
          编辑
        </button>
      </div>
      <div className="profile-grid">
        <div>
          <span className="profile-k">性别</span>
          <span>{student.gender ?? '—'}</span>
        </div>
        <div>
          <span className="profile-k">宿舍</span>
          <span>{student.dorm || '—'}</span>
        </div>
        <div>
          <span className="profile-k">导师</span>
          <span>{student.advisor || '未分包'}</span>
        </div>
        <div>
          <span className="profile-k">标签</span>
          <span>
            {student.tags?.length ? (
              student.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>
      {student.note ? <p className="profile-note">{student.note}</p> : <p className="muted">备注：空</p>}

      {editing && (
        <ProfileEditSheet student={student} onCancel={() => setEditing(false)} onSave={save} />
      )}
    </section>
  );
}

function ProfileEditSheet({
  student,
  onCancel,
  onSave,
}: {
  student: Student;
  onCancel: () => void;
  onSave: (patch: Partial<Student>) => Promise<void>;
}) {
  const [gender, setGender] = useState<'男' | '女' | ''>(student.gender ?? '');
  const [dorm, setDorm] = useState(student.dorm ?? '');
  const [note, setNote] = useState(student.note ?? '');
  const [tags, setTags] = useState((student.tags ?? []).join('、'));
  const [advisor, setAdvisor] = useState(student.advisor);

  const save = async () => {
    await onSave({
      gender: gender === '' ? undefined : (gender as '男' | '女'),
      dorm: dorm.trim() || undefined,
      note: note.trim() || undefined,
      tags: tags
        .split(/[、,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      advisor: advisor.trim(),
    });
  };

  return (
    <div className="sheet-mask" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">编辑档案 · {student.name}</h2>
        <div className="form-col">
          <div className="form-row">
            <select value={gender} onChange={(e) => setGender(e.target.value as '男' | '女' | '')} aria-label="性别">
              <option value="">性别未填</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
            <input value={dorm} onChange={(e) => setDorm(e.target.value)} placeholder="宿舍（如 5号楼201）" />
          </div>
          <input value={advisor} onChange={(e) => setAdvisor(e.target.value)} placeholder="分包导师" />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="标签，顿号分隔（如 临界生、手机管控）"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="备注（家庭情况概要 / 学业规划 / 需要记住的事）。不存电话和住址。"
          />
        </div>
        <div className="btn-row">
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button className="btn primary" onClick={save}>
            保存
          </button>
        </div>
        <p className="muted">改名请在导入表里做——按姓名匹配合并，改了名字会当成新学生。</p>
      </div>
    </div>
  );
}
