import { create } from 'zustand';
import type { Tag } from '../types';
import { generateUUID } from '../utils';
import { tagStorage } from '../utils/storage';
import { DEFAULT_TAG_COLORS } from '../types';

interface TagState {
  tags: Tag[];

  // CRUD 操作
  loadTags: () => void;
  createTag: (name: string, color?: string) => Tag;
  updateTag: (id: string, updates: Partial<Omit<Tag, 'id'>>) => void;
  deleteTag: (id: string) => void;

  // 辅助方法
  getTagById: (id: string) => Tag | undefined;
  getTagsByIds: (ids: string[]) => Tag[];
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],

  loadTags: () => {
    const tags = tagStorage.getAll() as Tag[];
    set({ tags });
  },

  createTag: (name: string, color?: string) => {
    const tagColor = color || DEFAULT_TAG_COLORS[get().tags.length % DEFAULT_TAG_COLORS.length];
    const newTag: Tag = {
      id: generateUUID(),
      name,
      color: tagColor,
    };
    tagStorage.save(newTag);
    set((state) => ({ tags: [...state.tags, newTag] }));
    return newTag;
  },

  updateTag: (id: string, updates: Partial<Omit<Tag, 'id'>>) => {
    tagStorage.update(id, updates);
    set((state) => ({
      tags: state.tags.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },

  deleteTag: (id: string) => {
    tagStorage.delete(id);
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
    }));
  },

  getTagById: (id: string) => {
    return get().tags.find((t) => t.id === id);
  },

  getTagsByIds: (ids: string[]) => {
    return get().tags.filter((t) => ids.includes(t.id));
  },
}));
