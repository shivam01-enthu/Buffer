import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
type ItemType = 'note' | 'link' | 'snippet' | 'image';
type BufferItem = {
  id: string;
  type: ItemType;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};
const STORAGE_KEY = 'pocketinbox.items.v1';
const GREEN = '#82A9FF';
const BG = '#090B0F';
const PANEL = '#121722';
const CARD = '#171B24';
const MUTED = '#9AA6BA';
const TYPES: { label: string; value: ItemType }[] = [
  { label: 'Note', value: 'note' },
  { label: 'Link', value: 'link' },
  { label: 'Snippet', value: 'snippet' },
  { label: 'Image', value: 'image' },
];
function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function normaliseItem(raw: any): BufferItem {
  const now = new Date().toISOString();
  return {
    id: String(raw?.id ?? makeId()),
    type:
      raw?.type === 'link' ||
      raw?.type === 'snippet' ||
      raw?.type === 'image'
        ? raw.type
        : 'note',
    title: String(raw?.title ?? 'Untitled'),
    content: String(raw?.content ?? ''),
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    createdAt: String(raw?.createdAt ?? now),
    updatedAt: String(raw?.updatedAt ?? now),
    archived: Boolean(raw?.archived),
  };
}
export default function HomeScreen() {
  const [items, setItems] = useState<BufferItem[]>([]);
  const [activePage, setActivePage] = useState<'feed' | 'categories'>('feed');
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<ItemType>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setItems(parsed.map(normaliseItem));
        }
      } catch {
        Alert.alert(
          'Storage issue',
          'Saved items could not be loaded. You can still create items.',
        );
      } finally {
        setLoaded(true);
      }
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {
      Alert.alert('Could not save', 'Check your device storage and try again.');
    });
  }, [items, loaded]);
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (item.archived !== showArchived) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (tagFilter && !item.tags.includes(tagFilter)) return false;
      const searchable =
        `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [items, search, showArchived, typeFilter, tagFilter]);
  const currentCollection = useMemo(
    () => items.filter((item) => item.archived === showArchived),
    [items, showArchived],
  );
  function openCreate(selectedType: ItemType = 'note') {
    setEditingId(null);
    setType(selectedType);
    setTitle('');
    setContent('');
    setTagsText('');
    setModalVisible(true);
  }
  function openEdit(item: BufferItem) {
    setEditingId(item.id);
    setType(item.type);
    setTitle(item.title);
    setContent(item.content);
    setTagsText(item.tags.join(', '));
    setModalVisible(true);
  }
  function saveItem() {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) {
      Alert.alert('Nothing to save', 'Add a title or some content first.');
      return;
    }
    if (type === 'link') {
      let parsed: URL;
      try {
        parsed = new URL(cleanContent);
      } catch {
        Alert.alert(
          'Invalid link',
          'Enter a complete URL, such as https://example.com.',
        );
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        Alert.alert('Invalid link', 'Only http:// and https:// links are supported.');
        return;
      }
    }
    if (
      type === 'image' &&
      !/^(https?:\/\/|file:\/\/|content:\/\/|data:image\/)/i.test(cleanContent)
    ) {
      Alert.alert(
        'Image location needed',
        'Paste an image URL or a local image URI.',
      );
      return;
    }
    const now = new Date().toISOString();
    const tags = Array.from(
      new Set(tagsText.split(',').map((tag) => tag.trim()).filter(Boolean)),
    );
    if (editingId) {
      setItems((current) =>
        current.map((item) =>
          item.id === editingId
            ? {
                ...item,
                type,
                title:
                  cleanTitle || (type === 'link' ? cleanContent : 'Untitled'),
                content: cleanContent,
                tags,
                updatedAt: now,
              }
            : item,
        ),
      );
    } else {
      const newItem: BufferItem = {
        id: makeId(),
        type,
        title:
          cleanTitle ||
          (type === 'link'
            ? cleanContent
            : type === 'image'
              ? 'Saved image'
              : type === 'snippet'
                ? 'Saved snippet'
                : 'Untitled note'),
        content: cleanContent,
        tags,
        createdAt: now,
        updatedAt: now,
        archived: false,
      };
      setItems((current) => [newItem, ...current]);
      setShowArchived(false);
      setActivePage('feed');
      setTypeFilter('all');
      setTagFilter('');
    }
    setModalVisible(false);
  }
  function toggleArchive(item: BufferItem) {
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((existing) =>
        existing.id === item.id
          ? { ...existing, archived: !existing.archived, updatedAt: now }
          : existing,
      ),
    );
  }
  function deleteItem(item: BufferItem) {
    Alert.alert('Delete saved item?', `Delete “${item.title}” permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          setItems((current) => current.filter((existing) => existing.id !== item.id)),
      },
    ]);
  }
  async function openItem(item: BufferItem) {
    if (item.type === 'link') {
      try {
        await Linking.openURL(item.content);
      } catch {
        Alert.alert(
          'Could not open link',
          'Check that the URL is valid and try again.',
        );
      }
    } else if (item.type === 'image') {
      setViewingImage(item.content);
    } else {
      openEdit(item);
    }
  }
  function dateLabel(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  }
  function openCategory(category: 'all' | ItemType) {
    setTypeFilter(category);
    setTagFilter('');
    setActivePage('feed');
  }
  function renderItem(item: BufferItem) {
    return (
      <View
        key={item.id}
        style={[
          styles.itemCard,
          typeFilter === 'image' && styles.imageGridCard,
        ]}
      >
        {item.type === 'image' && (
          <Pressable
            onPress={() => setViewingImage(item.content)}
            accessibilityRole="button"
            accessibilityLabel={`Preview image: ${item.title}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Image
              source={{ uri: item.content }}
              style={[
                styles.previewImage,
                typeFilter === 'image' && styles.gridImage,
              ]}
              resizeMode="cover"
              onError={() =>
                Alert.alert(
                  'Image could not load',
                  'Check that the saved image URL is valid and accessible.',
                )
              }
            />
          </Pressable>
        )}
        <Pressable onPress={() => openItem(item)} style={styles.itemMain}>
          <View style={styles.itemMetaRow}>
            <Text style={styles.itemType}>{item.type.toUpperCase()}</Text>
            <Text style={styles.date}>{dateLabel(item.updatedAt)}</Text>
          </View>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {item.type === 'link' ? (
            <Text style={styles.itemContent} numberOfLines={2}>
              {item.content}
            </Text>
          ) : item.type === 'note' || item.type === 'snippet' ? (
            <Text style={styles.itemContent} numberOfLines={3}>
              {item.content}
            </Text>
          ) : (
            <Text style={styles.itemContent} numberOfLines={1}>
              Tap to view image location
            </Text>
          )}
          {item.tags.length > 0 && (
            <View style={styles.tagList}>
              {item.tags.map((tag) => (
                <Text key={tag} style={styles.smallTag}>
                  #{tag}
                </Text>
              ))}
            </View>
          )}
        </Pressable>
        <View style={styles.actions}>
          <Pressable onPress={() => openEdit(item)} hitSlop={8}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => toggleArchive(item)} hitSlop={8}>
            <Text style={styles.actionText}>
              {item.archived ? 'Restore' : 'Archive'}
            </Text>
          </Pressable>
          <Pressable onPress={() => deleteItem(item)} hitSlop={8}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.container}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoGlyph}>B</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>Buffer</Text>
            <Text style={styles.subtitle}>YOUR LITTLE CORNER OF THE INTERNET</Text>
          </View>
        </View>
        <View style={styles.rule} />
        <TextInput
          style={styles.search}
          placeholder="Search notes, links and tags..."
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search saved items"
        />
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, !showArchived && styles.activeTab]}
            onPress={() => setShowArchived(false)}
          >
            <Text style={[styles.tabText, !showArchived && styles.activeTabText]}>
              Inbox · {items.filter((item) => !item.archived).length}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, showArchived && styles.activeTab]}
            onPress={() => setShowArchived(true)}
          >
            <Text style={[styles.tabText, showArchived && styles.activeTabText]}>
              Archived · {items.filter((item) => item.archived).length}
            </Text>
          </Pressable>
        </View>
        <View style={styles.pageSwitch}>
          <Pressable
            style={[
              styles.pageSwitchButton,
              activePage === 'feed' && styles.pageSwitchActive,
            ]}
            onPress={() => setActivePage('feed')}
          >
            <Text
              style={[
                styles.pageSwitchText,
                activePage === 'feed' && styles.pageSwitchTextActive,
              ]}
            >
              Feed
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.pageSwitchButton,
              activePage === 'categories' && styles.pageSwitchActive,
            ]}
            onPress={() => setActivePage('categories')}
          >
            <Text
              style={[
                styles.pageSwitchText,
                activePage === 'categories' && styles.pageSwitchTextActive,
              ]}
            >
              Categories
            </Text>
          </Pressable>
        </View>
        {activePage === 'categories' ? (
          <ScrollView
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              style={styles.everythingCard}
              onPress={() => openCategory('all')}
            >
              <View style={styles.categoryIcon}>
                <Text style={styles.categoryIconText}>≋</Text>
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryTitle}>All</Text>
                <Text style={styles.categoryCount}>
                  {currentCollection.length}{' '}
                  {currentCollection.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <Text style={styles.categoryArrow}>›</Text>
            </Pressable>
            <View style={styles.categoryGrid}>
              {TYPES.map((category) => {
                const count = currentCollection.filter(
                  (item) => item.type === category.value,
                ).length;
                const icon =
                  category.value === 'note'
                    ? '✎'
                    : category.value === 'link'
                      ? '↗'
                      : category.value === 'snippet'
                        ? '</>'
                        : '▧';
                const categoryName =
                  category.value === 'note'
                    ? 'Notes'
                    : category.value === 'snippet'
                      ? 'Snippets'
                      : category.value === 'image'
                        ? 'Images'
                        : 'Links';
                return (
                  <Pressable
                    key={category.value}
                    style={styles.categoryCard}
                    onPress={() => openCategory(category.value)}
                  >
                    <View style={styles.categorySmallIcon}>
                      <Text style={styles.categorySmallIconText}>{icon}</Text>
                    </View>
                    <Text style={styles.categoryTitle}>{categoryName}</Text>
                    <Text style={styles.categoryCount}>
                      {count} {count === 1 ? 'item' : 'items'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <>
            <View style={styles.filterRow}>
              {[
                { label: 'All', value: 'all' as const },
                ...TYPES.map((itemType) => ({
                  label: itemType.label,
                  value: itemType.value,
                })),
              ].map((filter) => (
                <Pressable
                  key={filter.value}
                  style={[
                    styles.chip,
                    typeFilter === filter.value && styles.chipActive,
                  ]}
                  onPress={() => setTypeFilter(filter.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      typeFilter === filter.value && styles.chipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ScrollView
              style={styles.feedScroll}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {visibleItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyGlyph}>✳</Text>
                  <Text style={styles.emptyTitle}>
                    {search || tagFilter ? 'No matching saves' : 'Your space is clear'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {search || tagFilter
                      ? 'Try another search or filter.'
                      : 'Save something useful to find it here later.'}
                  </Text>
                </View>
              ) : (
                visibleItems.map(renderItem)
              )}
            </ScrollView>
          </>
        )}
        <View style={styles.createRow}>
          <Pressable
            style={[styles.createButton, styles.primaryButton, styles.addButton]}
            onPress={() =>
              openCreate(
                activePage === 'categories' || typeFilter === 'all'
                  ? 'note'
                  : typeFilter,
              )
            }
          >
            <Text style={[styles.createText, styles.primaryButtonText]}>
              + Add{' '}
              {activePage === 'categories' || typeFilter === 'all'
                ? 'item'
                : typeFilter}
            </Text>
          </Pressable>
        </View>
      </View>
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingId ? 'Edit saved item' : 'Save something'}
            </Text>
            <Text style={styles.fieldLabel}>TYPE</Text>
            <View style={styles.typeRow}>
              {TYPES.map((itemType) => (
                <Pressable
                  key={itemType.value}
                  style={[
                    styles.typeButton,
                    type === itemType.value && styles.typeButtonActive,
                  ]}
                  onPress={() => setType(itemType.value)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      type === itemType.value && styles.typeButtonTextActive,
                    ]}
                  >
                    {itemType.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <TextInput
              style={styles.field}
              placeholder="Give it a useful name"
              placeholderTextColor={MUTED}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
            <Text style={styles.fieldLabel}>
              {type === 'link'
                ? 'URL'
                : type === 'image'
                  ? 'IMAGE URL OR URI'
                  : type === 'snippet'
                    ? 'SNIPPET'
                    : 'NOTE'}
            </Text>
            <TextInput
              style={[styles.field, styles.contentField]}
              placeholder={
                type === 'link'
                  ? 'https://example.com'
                  : type === 'image'
                    ? 'Paste an image URL or local URI'
                    : type === 'snippet'
                      ? 'Paste a useful text or code snippet...'
                      : 'Write something worth keeping...'
              }
              placeholderTextColor={MUTED}
              value={content}
              onChangeText={setContent}
              multiline={type === 'note' || type === 'snippet'}
              autoCapitalize={
                type === 'link' || type === 'image' || type === 'snippet'
                  ? 'none'
                  : 'sentences'
              }
              keyboardType={type === 'link' || type === 'image' ? 'url' : 'default'}
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>TAGS · COMMA SEPARATED</Text>
            <TextInput
              style={styles.field}
              placeholder="work, ideas, read-later"
              placeholderTextColor={MUTED}
              value={tagsText}
              onChangeText={setTagsText}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveItem}>
                <Text style={styles.saveButtonText}>Save to Buffer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={viewingImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
      >
        <View style={styles.imageViewer}>
          <Pressable
            style={styles.imageViewerClose}
            onPress={() => setViewingImage(null)}
          >
            <Text style={styles.imageViewerCloseText}>Close ✕</Text>
          </Pressable>
          {viewingImage !== null && (
            <Image
              source={{ uri: viewingImage }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  brandCopy: { flex: 1 },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F5F7FB',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
    letterSpacing: 0.4,
  },
  rule: {
    height: 1,
    backgroundColor: '#222B3C',
    marginBottom: 16,
  },
  search: {
    backgroundColor: CARD,
    color: '#F5F7FB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 54,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: PANEL,
    padding: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 7,
  },
  activeTab: { backgroundColor: CARD },
  tabText: { color: MUTED, fontSize: 15, fontWeight: '600' },
  activeTabText: { color: GREEN },
  pageSwitch: {
    flexDirection: 'row',
    backgroundColor: PANEL,
    padding: 3,
    borderRadius: 10,
    marginTop: 2,
    marginBottom: 12,
  },
  pageSwitchButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  pageSwitchActive: { backgroundColor: CARD },
  pageSwitchText: { color: MUTED, fontSize: 15, fontWeight: '600' },
  pageSwitchTextActive: { color: GREEN },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    flexWrap: 'nowrap',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 0,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#2A354B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { color: MUTED, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: BG },
  feedScroll: { flex: 1 },
  listContent: { paddingTop: 2, paddingBottom: 8 },
  itemCard: {
    backgroundColor: CARD,
    borderRadius: 15,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#242D3E',
  },
  previewImage: {
    height: 150,
    width: '100%',
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: PANEL,
  },
  itemMain: { paddingBottom: 12 },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemType: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  date: { color: MUTED, fontSize: 11 },
  itemTitle: {
    color: '#F5F7FB',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  itemContent: { color: '#C2CCDE', fontSize: 14, lineHeight: 20 },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  smallTag: {
    color: GREEN,
    fontSize: 11,
    backgroundColor: '#243B70',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: '#2A354B',
    paddingTop: 11,
  },
  actionText: { color: GREEN, fontSize: 12, fontWeight: '700' },
  deleteText: { color: '#F08B83', fontSize: 12, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 54,
    paddingHorizontal: 20,
  },
  emptyGlyph: { color: GREEN, fontSize: 34, marginBottom: 10 },
  emptyTitle: { color: '#F5F7FB', fontSize: 18, fontWeight: '700' },
  emptyText: {
    color: MUTED,
    fontSize: 13,
    marginTop: 7,
    textAlign: 'center',
    lineHeight: 19,
  },
  createRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 12,
  },
  createButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#35435C',
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: PANEL,
  },
  primaryButton: { backgroundColor: GREEN, borderColor: GREEN },
  createText: { color: '#F5F7FB', fontSize: 13, fontWeight: '700' },
  primaryButtonText: { color: BG },
  addButton: {
    width: '100%',
    flex: 0,
    paddingVertical: 12,
  },
  categoryScroll: { flex: 1 },
  categoryContent: { paddingTop: 2, paddingBottom: 12 },
  everythingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#35435C',
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    minHeight: 92,
  },
  categoryInfo: { flex: 1, marginLeft: 12 },
  categoryIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#243B70',
    borderWidth: 1,
    borderColor: '#405D96',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: { color: GREEN, fontSize: 29, fontWeight: '800' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  categoryCard: {
    width: '48.5%',
    minHeight: 142,
    padding: 14,
    borderRadius: 15,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#2A354B',
    justifyContent: 'center',
  },
  categorySmallIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#243B70',
    borderWidth: 1,
    borderColor: '#354F7F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categorySmallIconText: {
    color: GREEN,
    fontSize: 20,
    fontWeight: '800',
  },
  categoryTitle: {
    color: '#F5F7FB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  categoryCount: { color: MUTED, fontSize: 12, lineHeight: 17 },
  categoryArrow: { color: GREEN, fontSize: 28, marginLeft: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: PANEL,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 30,
    maxHeight: '92%',
  },
  modalTitle: {
    color: '#F5F7FB',
    fontSize: 23,
    fontWeight: '800',
    marginBottom: 17,
  },
  fieldLabel: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 7,
    marginTop: 8,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#35435C',
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeButtonActive: { backgroundColor: GREEN, borderColor: GREEN },
  typeButtonText: { color: '#E1E8F5', fontWeight: '600' },
  typeButtonTextActive: { color: BG },
  field: {
    backgroundColor: CARD,
    color: '#F5F7FB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2A354B',
  },
  contentField: { minHeight: 90, maxHeight: 170 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: CARD,
  },
  cancelText: { color: '#E0E7F5', fontWeight: '700' },
  saveButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: GREEN,
  },
  saveButtonText: { color: BG, fontWeight: '800' },
  imageGridCard: {
    width: '48%',
    padding: 10,
    marginBottom: 10,
  },
  gridImage: {
    width: '100%',
    height: 135,
    marginBottom: 8,
  },
  imageViewer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  imageViewerClose: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  imageViewerCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imageViewerImage: { width: '100%', height: '85%' },
});
