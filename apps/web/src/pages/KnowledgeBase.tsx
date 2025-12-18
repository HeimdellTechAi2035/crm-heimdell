import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useBrand } from '../store/brand';

interface KnowledgeArticle {
  id: string;
  title: string;
  body: string;
  tags: string[];
  visibility: 'public' | 'internal' | 'private';
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export function KnowledgeBase() {
  const { selectedBrand, loading: brandLoading } = useBrand();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch articles if brand context has loaded
    if (!brandLoading) {
      fetchArticles();
    }
  }, [selectedBrand?.id, searchQuery, selectedTag, brandLoading]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBrand?.id) params.append('business_unit_id', selectedBrand.id);
      if (searchQuery) params.append('search', searchQuery);
      if (selectedTag) params.append('tag', selectedTag);

      const response = await api.get(`/api/knowledge/articles?${params.toString()}`);
      setArticles(response.data);
      setError(null);
    } catch (err: any) {
      console.warn('Failed to load knowledge articles:', err.message);
      setError(err.message || 'Failed to load articles');
      setArticles([]); // Fail gracefully
    } finally {
      setLoading(false);
    }
  };

  const getAllTags = () => {
    const tagSet = new Set<string>();
    articles.forEach((article) => {
      article.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };

  const selectArticle = async (articleId: string) => {
    try {
      const response = await api.get(`/api/knowledge/articles/${articleId}`);
      setSelectedArticle(response.data);
    } catch (err: any) {
      console.error('Failed to load article:', err);
    }
  };

  const allTags = getAllTags();

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-600 mt-1">Search articles and playbooks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">Filter by Tag</label>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedTag === null
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All Articles
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedTag === tag
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Article Count */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{articles.length}</span> article
              {articles.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading articles...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-red-700">{error}</p>
            </div>
          ) : selectedArticle ? (
            /* Article Detail View */
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-blue-100 hover:text-white text-sm mb-2 inline-flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to articles
                </button>
                <h2 className="text-2xl font-bold text-white">{selectedArticle.title}</h2>
                <p className="text-blue-100 text-sm mt-1">
                  {selectedArticle.viewCount} views • Updated{' '}
                  {new Date(selectedArticle.updatedAt).toLocaleDateString()}
                </p>
              </div>

              <div className="p-6">
                {/* Tags */}
                {selectedArticle.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {selectedArticle.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Body (Markdown) */}
                <div className="prose prose-sm max-w-none">
                  <div
                    className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: selectedArticle.body }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Article List */
            <div className="space-y-3">
              {articles.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
                  <p className="text-gray-600">Try adjusting your search or filters</p>
                </div>
              ) : (
                articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => selectArticle(article.id)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {article.title}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {article.body.substring(0, 150)}...
                        </p>
                        <div className="flex items-center flex-wrap gap-2">
                          {article.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {tag}
                            </span>
                          ))}
                          {article.tags.length > 3 && (
                            <span className="text-xs text-gray-500">+{article.tags.length - 3} more</span>
                          )}
                        </div>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
