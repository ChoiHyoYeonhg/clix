//\app\page.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from '@/firebase/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  where,
  limit,
  startAfter,
} from 'firebase/firestore'
import Link from 'next/link'
import styles from './page.module.css'
import { toast } from 'react-hot-toast'
import FloatingButton from './components/FloatingButton'

interface Post {
  id: string
  title: string
  content: string
  thumbnailUrl?: string
  detailImages?: string[]
  author: {
    name: string
    email: string
  }
  createdAt: {
    toDate: () => Date
  }
  likes: string[]
  views: number
  teamName?: string
}

interface Banner {
  id: string
  imageUrl: string
  position: 'right'
  isActive: boolean
  order: number
  year?: string
}

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [banners, setBanners] = useState<Banner[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [showLoadMoreButton, setShowLoadMoreButton] = useState(false)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  const observer = useRef<IntersectionObserver | null>(null)
  const POSTS_PER_PAGE = 9

  // 로그인 상태 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const userRef = doc(db, 'users', user.email)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          setCurrentUser(user)
        } else {
          toast.error('회원가입을 먼저 완료해주세요.')
          await signOut(auth)
          router.push('/signup')
        }
      } else {
        setCurrentUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  // 게시물 불러오기
  const fetchPosts = async (isInitial: boolean = false) => {
    try {
      let q
      if (isInitial) {
        q = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(POSTS_PER_PAGE)
        )
      } else {
        q = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(POSTS_PER_PAGE)
        )
      }

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        setHasMore(false)
        setShowLoadMoreButton(false)
        return
      }

      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1])

      const postsData = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const postData = docSnapshot.data() as any

          // 댓글 수 가져오기
          const commentsSnapshot = await getDocs(
            collection(db, 'posts', docSnapshot.id, 'comments')
          )
          const commentsCount = commentsSnapshot.size

          // author 정보가 없는 경우 처리
          if (!postData.author) {
            return {
              id: docSnapshot.id,
              ...postData,
              author: {
                name: '익명',
                email: 'unknown',
              },
              likes: postData.likes || [],
              views: postData.views || 0,
              comments: commentsCount,
            } as Post
          }

          // author.email 정보가 없는 경우 처리
          if (!postData.author.email) {
            return {
              id: docSnapshot.id,
              ...postData,
              author: {
                ...postData.author,
                name: postData.author.name || '익명',
                email: 'unknown',
              },
              likes: postData.likes || [],
              views: postData.views || 0,
              comments: commentsCount,
            } as Post
          }

          return {
            id: docSnapshot.id,
            ...postData,
            author: {
              name: postData.author.name || '익명',
              email: postData.author.email,
            },
            likes: postData.likes || [],
            views: postData.views || 0,
            comments: commentsCount,
          } as Post
        })
      )

      setPosts((prevPosts) =>
        isInitial ? postsData : [...prevPosts, ...postsData]
      )

      // 9개 이상의 게시물이 있으면 화살표 버튼 표시
      if (isInitial && postsData.length === POSTS_PER_PAGE) {
        setShowLoadMoreButton(true)
      }
    } catch (error) {
      console.error('게시물 로딩 중 오류:', error)
      toast.error('게시물을 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 초기 게시물 로드
  useEffect(() => {
    fetchPosts(true)
  }, [])

  // 수동으로 더 많은 게시물 로드
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      await fetchPosts(false)
    } finally {
      setLoadingMore(false)
    }
  }

  // 스크롤 이벤트 리스너 추가
  useEffect(() => {
    const handleScroll = () => {
      if (showLoadMoreButton && !loadingMore && hasMore) {
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop
        const windowHeight = window.innerHeight
        const documentHeight = document.documentElement.scrollHeight

        // 스크롤이 페이지 하단 근처에 도달했을 때
        if (scrollTop + windowHeight >= documentHeight - 100) {
          setShowLoadMoreButton(true)
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showLoadMoreButton, loadingMore, hasMore])

  // 배너 불러오기
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const bannersRef = collection(db, 'banners')

        // 메인 페이지 배너: year 필드가 없는 배너만 표시
        const q = query(
          bannersRef,
          where('isActive', '==', true),
          where('position', '==', 'right')
        )
        const querySnapshot = await getDocs(q)
        const bannersData = querySnapshot.docs
          .map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              } as Banner)
          )
          .filter((banner) => !banner.year) // year 필드가 없는 배너만 필터링

        // order 기준으로 정렬
        setBanners(bannersData.sort((a, b) => a.order - b.order))
      } catch (error) {
        console.error('배너 로딩 중 오류:', error)
      }
    }

    fetchBanners()
  }, [])

  const handleView = async (postId: string) => {
    try {
      const postRef = doc(db, 'posts', postId)
      await updateDoc(postRef, {
        views: increment(1),
      })

      // 게시물 목록 업데이트
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              views: (post.views || 0) + 1,
            }
          }
          return post
        })
      )
    } catch (error) {
      console.error('조회수 증가 중 오류:', error)
    }
  }

  const handleLike = async (
    postId: string,
    likes: string[],
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser?.email) {
      toast.error('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    try {
      const postRef = doc(db, 'posts', postId)
      const newLikes = likes.includes(currentUser.email)
        ? likes.filter((email) => email !== currentUser.email)
        : [...likes, currentUser.email]

      await updateDoc(postRef, {
        likes: newLikes,
      })

      // 게시물 목록 업데이트
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              likes: newLikes,
            }
          }
          return post
        })
      )

      toast.success(
        newLikes.includes(currentUser.email)
          ? '좋아요를 눌렀습니다.'
          : '좋아요를 취소했습니다.'
      )
    } catch (error) {
      console.error('좋아요 처리 중 오류:', error)
      toast.error('좋아요 처리 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.leftSpace} />
      <div className={styles.mainContent}>
        <div className={styles.postsGrid}>
          {posts.length === 0 ? (
            <p>등록된 게시물이 없습니다.</p>
          ) : (
            posts.map((post, index) => (
              <div key={post.id} className={styles.card}>
                <div className={styles.imageContainer}>
                  <Link
                    href={`/post/${post.id}`}
                    onClick={() => handleView(post.id)}
                  >
                    {post.thumbnailUrl ? (
                      <img
                        src={post.thumbnailUrl}
                        alt={post.title}
                        className={styles.cardImage}
                      />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <span>이미지 없음</span>
                      </div>
                    )}
                  </Link>
                </div>
                <div className={styles.cardContent}>
                  <h3>{post.title}</h3>
                  <div className={styles.cardInfo}>
                    <span>팀명: {post.teamName || '미지정'}</span>
                    <span>작성자: {post.author.name}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardStats}>
                      <button
                        className={`${styles.likeButton} ${
                          post.likes.includes(currentUser?.email || '')
                            ? styles.liked
                            : ''
                        }`}
                        onClick={(e) => handleLike(post.id, post.likes, e)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill={
                            post.likes.includes(currentUser?.email || '')
                              ? '#ff4d4d'
                              : 'none'
                          }
                          stroke="currentColor"
                          strokeWidth="2"
                          className={styles.heartIcon}
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        <span>{post.likes.length}</span>
                      </button>
                      <span className={styles.views}>
                        조회수: {post.views.toLocaleString()}
                      </span>
                      <span className={styles.createdAt}>
                        {post.createdAt.toDate().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {showLoadMoreButton && (
          <button
            className={styles.loadMoreButton}
            onClick={handleLoadMore}
            disabled={loadingMore || !hasMore}
          >
            {loadingMore ? '로딩 중...' : '더 많은 게시물 보기'}
          </button>
        )}
      </div>
      <div className={styles.rightBanner}>
        {banners.map((banner) => (
          <img
            key={banner.id}
            src={banner.imageUrl}
            alt="메인 배너"
            className={styles.bannerImage}
          />
        ))}
      </div>
    </div>
  )
}
